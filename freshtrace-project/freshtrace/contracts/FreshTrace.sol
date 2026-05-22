// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FreshTrace
 * @author INTE264 Group 7, RMIT University Vietnam
 * @notice On-chain audit log for OCOP-certified produce moving from farm
 *         to consumer in Vietnam.
 *
 * Every batch gets a unique on-chain id. Participants append tamper-proof
 * checkpoints as the product moves down the supply chain. Nothing is ever
 * deleted, so the trail is always complete.
 *
 * Why these choices:
 *  - OpenZeppelin AccessControl over Ownable: we need four roles working
 *    in parallel (Producer, Logistics, Retailer, Auditor) with different
 *    permissions, not one super-user.
 *  - Forward-only checkpoint ordering stops anyone from rewriting history
 *    after the fact (you cannot insert a PROCESSED step once SHIPPED has
 *    already been recorded).
 *  - Append-only Checkpoint array: there is no delete or overwrite, the
 *    blockchain enforces immutability at the data level.
 *  - Custom errors instead of revert strings: cheaper in gas and carry
 *    typed data (batchId, action) that the front end can act on.
 *  - IPFS hashes stored on-chain: images and documents stay off-chain
 *    where they belong, but the immutable CID is anchored to the record.
 */
contract FreshTrace is AccessControl {

    // Roles
    // One role per supply chain actor. The admin (deployer) grants and
    // revokes them at runtime via grantRole, no code changes needed.

    /// @dev Farmers who register new produce batches at harvest.
    bytes32 public constant PRODUCER_ROLE  = keccak256("PRODUCER_ROLE");

    /// @dev Transport and warehouse operators that move goods between stages.
    bytes32 public constant LOGISTICS_ROLE = keccak256("LOGISTICS_ROLE");

    /// @dev End sellers receiving finished goods for consumers.
    bytes32 public constant RETAILER_ROLE  = keccak256("RETAILER_ROLE");

    /// @dev Inspectors that can raise quality or safety flags on any batch.
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");


    // Enums

    /**
     * @notice The five lifecycle stages a batch passes through, in order.
     * @dev The integer value of each stage drives forward-only enforcement:
     *      a new action is accepted only when its value is strictly greater
     *      than the last main-flow action.
     *      HARVESTED (0) is set automatically by registerBatch and is never
     *      a valid argument to logCheckpoint.
     */
    enum ActionType {
        HARVESTED,  // 0  recorded at farm by producer
        PROCESSED,  // 1  washing, grading, initial handling
        PACKED,     // 2  packaged for distribution
        SHIPPED,    // 3  in transit to retailer
        RECEIVED    // 4  accepted at final retail location
    }

    /**
     * @notice The unit of Batch.quantity.
     * @dev Stored on-chain so consumers know whether 5000 means 5 kg
     *      (GRAMS) or 5 tonnes (KILOGRAMS). The UI shows the symbol next
     *      to the number.
     */
    enum QuantityUnit {
        GRAMS,      // 0  small batches like premium fruit boxes
        KILOGRAMS   // 1  bulk produce
    }


    // Structs

    /**
     * @notice Core metadata for a registered batch.
     * @dev Stored in a mapping keyed by the deterministic batchId hash.
     *      The `exists` field is a presence sentinel so we never compare
     *      addresses to zero to check whether a slot has been filled.
     */
    struct Batch {
        string       productName;  // human-readable name, e.g. "Da Lat Strawberry"
        string       origin;       // where it came from, e.g. "Da Lat, Lam Dong"
        uint256      harvestDate;  // unix seconds
        uint256      quantity;     // amount in the unit below
        QuantityUnit unit;         // GRAMS or KILOGRAMS
        address      producer;     // wallet that called registerBatch
        bool         ocop;         // true if the batch carries OCOP certification
        bool         exists;       // sentinel: true once registered
        bool         flagged;      // true if at least one unresolved audit flag
        string       ipfsHash;     // Pinata CID for the product photo or cert
    }

    /**
     * @notice A single event in a batch's history.
     * @dev Two kinds of checkpoints share this struct:
     *      1. Main-flow checkpoints (addonLabel == "") follow the strict
     *         forward-only order enforced in logCheckpoint.
     *      2. Add-on checkpoints (addonLabel != "") are custom named steps
     *         like "Quality Check" or "Cold Storage", logged via logAddon,
     *         and they do not affect main-flow ordering.
     *      Keeping both kinds in one struct makes getHistory a single
     *      call and the timeline naturally chronological.
     */
    struct Checkpoint {
        address    actor;       // wallet that logged this event
        string     location;    // where it happened
        uint256    timestamp;   // block.timestamp at log time (unix seconds)
        ActionType action;      // lifecycle stage, ignored for add-ons
        string     ipfsHash;    // optional photo evidence CID
        string     addonLabel;  // non-empty means this is an add-on entry
    }

    /**
     * @notice A quality or safety concern raised by an auditor.
     * @dev Flags are informational: they do not block further checkpoints.
     *      A batch can accumulate multiple flags from different auditors,
     *      and each one can be resolved independently. batch.flagged
     *      stays true while any flag is still unresolved.
     */
    struct AuditFlag {
        address auditor;     // wallet that raised the flag
        string  reason;      // free-text description of the concern
        uint256 timestamp;   // when the flag was raised
        bool    resolved;    // true once an auditor marks it as addressed
        address resolvedBy;  // wallet that resolved it (zero if not yet)
        uint256 resolvedAt;  // when it was resolved (0 if not yet)
    }


    // State

    /// @dev batchId -> metadata
    mapping(bytes32 => Batch) private batches;

    /// @dev batchId -> append-only event log. Push only, no pop or delete.
    mapping(bytes32 => Checkpoint[]) private checkpoints;

    /// @dev batchId -> all flags raised against it, in raise order.
    mapping(bytes32 => AuditFlag[]) private auditFlags;

    /// @dev Insertion-ordered list of every batchId, used by getBatchIds.
    bytes32[] private batchIds;


    // Validation limits
    // Length caps stop a caller from grief-attacking storage with huge
    // strings. Date caps catch obvious user typos.

    uint256 private constant MAX_NAME_LEN     = 300;  // ~100 Vietnamese chars or 300 ASCII
    uint256 private constant MAX_LOCATION_LEN = 200;
    uint256 private constant MAX_REASON_LEN   = 500;
    uint256 private constant MAX_LABEL_LEN    = 100;
    uint256 private constant MAX_IPFS_LEN     = 100;

    /// @dev Reject a harvest date more than 30 days ahead of now. Catches
    ///      typos like "2030" when the user meant "2023". There is no past
    ///      floor on purpose: legacy migrations should not be blocked.
    uint256 private constant MAX_HARVEST_LOOKAHEAD = 30 days;


    // Custom errors

    /// @dev Thrown by logCheckpoint when the requested action would go
    ///      backwards or stay on the same stage as the last main-flow one.
    error AnomalyDetected(bytes32 batchId, ActionType attempted, ActionType last);

    /// @dev Thrown whenever a function receives a batchId that was never registered.
    error BatchNotFound(bytes32 batchId);

    /// @dev Thrown by registerBatch on a hash collision (essentially impossible
    ///      with abi.encode + block.timestamp, but kept defensively).
    error BatchAlreadyExists(bytes32 batchId);


    // Events
    // Indexed fields let the front end filter cheaply on batchId.

    /// @notice Fired when a producer registers a new batch.
    event BatchRegistered(
        bytes32 indexed batchId,
        string productName,
        string origin,
        address producer
    );

    /// @notice Fired after a successful main-flow checkpoint.
    event CheckpointLogged(
        bytes32 indexed batchId,
        address actor,
        ActionType action,
        string location
    );

    /// @notice Fired when an auditor flags a batch for review.
    event BatchFlagged(
        bytes32 indexed batchId,
        address auditor,
        string reason
    );

    /// @notice Fired when an add-on process step is logged.
    event AddonLogged(
        bytes32 indexed batchId,
        address actor,
        string addonLabel,
        string location
    );

    /// @notice Fired when an auditor marks a flag as resolved.
    event FlagResolved(
        bytes32 indexed batchId,
        address resolvedBy,
        uint256 flagIndex
    );


    // Constructor

    /**
     * @dev Grants DEFAULT_ADMIN_ROLE to the deployer so they can later
     *      grant the four participant roles via grantRole without needing
     *      a redeploy.
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    // Write functions

    /**
     * @notice Register a new batch. Auto-logs the initial HARVESTED checkpoint
     *         in the same transaction so the timeline always starts at stage 0.
     * @dev Access: PRODUCER_ROLE only.
     *
     *      The batchId is a keccak256 hash of (productName, origin,
     *      harvestDate, msg.sender, block.timestamp). The timestamp in
     *      the seed lets the same producer register the same product on
     *      different days without collision.
     *
     *      Pairing the registration and the first checkpoint atomically
     *      keeps getHistory simple: callers never see a batch with zero
     *      checkpoints.
     */
    function registerBatch(
        string calldata productName,
        string calldata origin,
        uint256 harvestDate,
        uint256 quantity,
        QuantityUnit unit,
        bool ocop,
        string calldata ipfsHash
    ) external onlyRole(PRODUCER_ROLE) returns (bytes32) {

        // Input validation. Reject empty and oversized strings up front.
        require(bytes(productName).length > 0,                      "productName required");
        require(bytes(productName).length <= MAX_NAME_LEN,          "productName too long");
        require(bytes(origin).length > 0,                           "origin required");
        require(bytes(origin).length <= MAX_NAME_LEN,               "origin too long");
        require(bytes(ipfsHash).length <= MAX_IPFS_LEN,             "ipfsHash too long");
        require(quantity > 0,                                       "quantity must be > 0");
        require(harvestDate <= block.timestamp + MAX_HARVEST_LOOKAHEAD, "harvestDate too far in future");

        // Derive a collision-resistant id. We use abi.encode rather than
        // abi.encodePacked because packed encoding of dynamic types can
        // produce the same bytes for different inputs (e.g. "ab"+"cd" and
        // "a"+"bcd" both pack to "abcd").
        bytes32 batchId = keccak256(
            abi.encode(productName, origin, harvestDate, msg.sender, block.timestamp)
        );

        if (batches[batchId].exists) {
            revert BatchAlreadyExists(batchId);
        }

        batches[batchId] = Batch({
            productName: productName,
            origin:      origin,
            harvestDate: harvestDate,
            quantity:    quantity,
            unit:        unit,
            producer:    msg.sender,
            ocop:        ocop,
            exists:      true,
            flagged:     false,
            ipfsHash:    ipfsHash
        });

        batchIds.push(batchId);

        // First checkpoint at HARVESTED. The forward-only check in
        // logCheckpoint compares against this entry next time around.
        checkpoints[batchId].push(Checkpoint({
            actor:      msg.sender,
            location:   origin,
            timestamp:  block.timestamp,
            action:     ActionType.HARVESTED,
            ipfsHash:   "",
            addonLabel: ""
        }));

        emit BatchRegistered(batchId, productName, origin, msg.sender);
        return batchId;
    }

    /**
     * @notice Append a main-flow checkpoint to an existing batch.
     * @dev Access: LOGISTICS_ROLE or RETAILER_ROLE.
     *
     *      Forward-only rule: the integer value of `action` must be
     *      strictly greater than the last MAIN-FLOW action. We walk the
     *      array backwards to find that last main-flow entry, skipping
     *      any add-on checkpoints in between. Without that skip, an add-on
     *      (which stores ActionType.HARVESTED as a placeholder) would
     *      look like a backward jump and break the rule incorrectly.
     */
    function logCheckpoint(
        bytes32 batchId,
        ActionType action,
        string calldata location,
        string calldata ipfsHash
    ) external {
        require(
            hasRole(LOGISTICS_ROLE, msg.sender) || hasRole(RETAILER_ROLE, msg.sender),
            "Caller lacks LOGISTICS_ROLE or RETAILER_ROLE"
        );

        require(bytes(location).length > 0,                "location required");
        require(bytes(location).length <= MAX_LOCATION_LEN, "location too long");
        require(bytes(ipfsHash).length <= MAX_IPFS_LEN,     "ipfsHash too long");

        if (!batches[batchId].exists) revert BatchNotFound(batchId);

        // Walk backwards looking for the last main-flow checkpoint
        // (addonLabel empty) and compare against its action.
        Checkpoint[] storage cps = checkpoints[batchId];
        if (cps.length > 0) {
            for (uint256 i = cps.length; i > 0; i--) {
                if (bytes(cps[i - 1].addonLabel).length == 0) {
                    ActionType lastAction = cps[i - 1].action;
                    if (uint256(action) <= uint256(lastAction)) {
                        revert AnomalyDetected(batchId, action, lastAction);
                    }
                    break;
                }
            }
        }

        cps.push(Checkpoint({
            actor:      msg.sender,
            location:   location,
            timestamp:  block.timestamp,
            action:     action,
            ipfsHash:   ipfsHash,
            addonLabel: ""  // empty marks this as a main-flow checkpoint
        }));

        emit CheckpointLogged(batchId, msg.sender, action, location);
    }

    /**
     * @notice Append a custom add-on process step that sits outside the
     *         main HARVESTED -> RECEIVED lifecycle order.
     * @dev Access: any of the four roles can log add-ons.
     *
     *      Use cases: "Quality Lab Test", "Cold Storage Entry",
     *      "Fumigation", "Repackaging". These are real supply chain
     *      events that do not fit the five main stages.
     *
     *      Add-ons store HARVESTED in the action field as a placeholder
     *      because the value is meaningless for them. The addonLabel
     *      string is what distinguishes them in the UI.
     */
    function logAddon(
        bytes32 batchId,
        string calldata addonLabel,
        string calldata location,
        string calldata ipfsHash
    ) external {
        require(
            hasRole(PRODUCER_ROLE,  msg.sender) ||
            hasRole(LOGISTICS_ROLE, msg.sender) ||
            hasRole(RETAILER_ROLE,  msg.sender) ||
            hasRole(AUDITOR_ROLE,   msg.sender),
            "No authorized role"
        );
        if (!batches[batchId].exists) revert BatchNotFound(batchId);

        require(bytes(addonLabel).length > 0,                "addonLabel required");
        require(bytes(addonLabel).length <= MAX_LABEL_LEN,   "addonLabel too long");
        require(bytes(location).length <= MAX_LOCATION_LEN,  "location too long");
        require(bytes(ipfsHash).length <= MAX_IPFS_LEN,      "ipfsHash too long");

        checkpoints[batchId].push(Checkpoint({
            actor:      msg.sender,
            location:   location,
            timestamp:  block.timestamp,
            action:     ActionType.HARVESTED,  // placeholder, not used for add-ons
            ipfsHash:   ipfsHash,
            addonLabel: addonLabel
        }));

        emit AddonLogged(batchId, msg.sender, addonLabel, location);
    }

    /**
     * @notice Raise a quality or safety concern on a batch. Warning only,
     *         it does not stop further checkpoints.
     * @dev Access: AUDITOR_ROLE only.
     *
     *      Flagging sets batch.flagged = true and appends an AuditFlag.
     *      Logistics is intentionally allowed to keep moving the goods
     *      so in-transit shipments do not get stranded. The flag is
     *      surfaced loudly in the UI (FlaggedBanner) so everyone sees it.
     *
     *      A batch can carry multiple flags from different auditors.
     */
    function flagBatch(
        bytes32 batchId,
        string calldata reason
    ) external onlyRole(AUDITOR_ROLE) {
        if (!batches[batchId].exists) revert BatchNotFound(batchId);

        require(bytes(reason).length > 0,              "reason required");
        require(bytes(reason).length <= MAX_REASON_LEN, "reason too long");

        batches[batchId].flagged = true;

        auditFlags[batchId].push(AuditFlag({
            auditor:    msg.sender,
            reason:     reason,
            timestamp:  block.timestamp,
            resolved:   false,
            resolvedBy: address(0),
            resolvedAt: 0
        }));

        emit BatchFlagged(batchId, msg.sender, reason);
    }

    /**
     * @notice Mark a flag as resolved once the concern has been addressed.
     * @dev Access: AUDITOR_ROLE only.
     *
     *      After resolution we recompute batch.flagged: it stays true if
     *      any other flag is still open, otherwise it drops to false and
     *      the consumer-facing warning banner disappears.
     */
    function resolveFlag(bytes32 batchId, uint256 flagIndex) external onlyRole(AUDITOR_ROLE) {
        if (!batches[batchId].exists) revert BatchNotFound(batchId);
        require(flagIndex < auditFlags[batchId].length, "Invalid flag index");
        require(!auditFlags[batchId][flagIndex].resolved, "Flag already resolved");

        auditFlags[batchId][flagIndex].resolved   = true;
        auditFlags[batchId][flagIndex].resolvedBy = msg.sender;
        auditFlags[batchId][flagIndex].resolvedAt = block.timestamp;

        // Stay flagged only if any flag is still open.
        bool anyUnresolved = false;
        for (uint256 i = 0; i < auditFlags[batchId].length; i++) {
            if (!auditFlags[batchId][i].resolved) { anyUnresolved = true; break; }
        }
        batches[batchId].flagged = anyUnresolved;

        emit FlagResolved(batchId, msg.sender, flagIndex);
    }


    // View functions (read-only, no gas off-chain)

    /**
     * @notice Return the full traceability record for a batch in one call.
     * @dev Bundling everything into a single tuple keeps the front end's
     *      RPC count low. Consumers, auditors, and logistics all use this.
     */
    function getHistory(bytes32 batchId)
        external
        view
        returns (Batch memory, Checkpoint[] memory, AuditFlag[] memory)
    {
        if (!batches[batchId].exists) revert BatchNotFound(batchId);
        return (batches[batchId], checkpoints[batchId], auditFlags[batchId]);
    }

    /**
     * @notice Return every registered batchId for the Dashboard to enumerate.
     * @dev Order: insertion order. Returns the entire array, so prefer
     *      getBatchIdsPaginated once the batch count grows past a few
     *      hundred to keep the RPC response cheap.
     */
    function getBatchIds() external view returns (bytes32[] memory) {
        return batchIds;
    }

    /**
     * @notice Paginated slice of batchIds for the Dashboard.
     * @dev Use this in production. The unpaginated getBatchIds is kept
     *      for backward compatibility with simple integrations.
     *
     *      Returns batchIds[offset : offset+limit]. If offset is past the
     *      end, returns an empty array (rather than reverting) so the UI
     *      can detect "no more pages" naturally.
     *
     * @param offset Starting index, zero-based, in insertion order.
     * @param limit  Maximum number of ids to return in this call.
     */
    function getBatchIdsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory page)
    {
        uint256 total = batchIds.length;
        if (offset >= total || limit == 0) {
            return new bytes32[](0);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = batchIds[i];
        }
    }

    /**
     * @notice Return the total number of registered batches.
     * @dev Useful for the Dashboard counter and for deciding whether
     *      to call the more expensive getBatchIds.
     */
    function getBatchCount() external view returns (uint256) {
        return batchIds.length;
    }
}
