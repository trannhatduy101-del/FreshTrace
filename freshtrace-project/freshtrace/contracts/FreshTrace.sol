// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FreshTrace
 * @author INTE264 Group 7 — RMIT University Vietnam
 * @notice Immutable audit log for Vietnam's OCOP-certified agricultural supply chain.
 *
 * FreshTrace records every stage of a produce batch's journey from farm to consumer
 * on the Polygon blockchain. Each batch gets a unique on-chain ID; participants
 * append tamper-proof checkpoints as the product moves through the supply chain.
 *
 * Design decisions:
 * - AccessControl (OpenZeppelin) over Ownable: multiple distinct roles are needed
 *   simultaneously (Producer, Logistics, Retailer, Auditor) with different permissions.
 * - Forward-only checkpoint ordering: prevents retroactive falsification of the
 *   supply-chain history (e.g., cannot insert a PROCESSED step after RECEIVED).
 * - Append-only Checkpoint array: blockchain immutability means entries are never
 *   deleted or overwritten; the entire audit trail is always visible.
 * - Custom errors (Solidity ≥0.8.4): more gas-efficient than revert strings and
 *   carry structured data (batchId, action) for easier off-chain handling.
 * - IPFS hashes stored on-chain: keeps images/documents decentralised while the
 *   immutable CID reference is anchored to the blockchain record.
 */
contract FreshTrace is AccessControl {

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // Each supply-chain actor receives exactly one role. The admin (deployer)
    // can grant/revoke roles via grantRole() without changing contract code.
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Farmers who register new produce batches at harvest time.
    bytes32 public constant PRODUCER_ROLE  = keccak256("PRODUCER_ROLE");

    /// @dev Transporters and warehouse operators who move goods between stages.
    bytes32 public constant LOGISTICS_ROLE = keccak256("LOGISTICS_ROLE");

    /// @dev End-point sellers who receive and hold finished goods for consumers.
    bytes32 public constant RETAILER_ROLE  = keccak256("RETAILER_ROLE");

    /// @dev Inspectors who can raise quality or safety flags on any batch.
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");


    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice The five ordered lifecycle stages a batch passes through.
     * @dev    The uint value of each stage is used for forward-only enforcement:
     *         a new action is only accepted if its uint value is strictly greater
     *         than the last recorded action's uint value.
     *         HARVESTED (0) is automatically set by registerBatch() and is never
     *         a selectable action in logCheckpoint().
     */
    enum ActionType {
        HARVESTED,  // 0 — recorded at farm by producer
        PROCESSED,  // 1 — washing, grading, initial handling
        PACKED,     // 2 — packaged for distribution
        SHIPPED,    // 3 — in transit to retailer
        RECEIVED    // 4 — accepted at final retail location
    }

    /**
     * @notice The unit in which `Batch.quantity` is measured.
     * @dev    Stored on-chain so consumers know whether a quantity of "5000"
     *         means 5 kg (GRAMS) or 5 tonnes (KILOGRAMS). UI displays the
     *         unit symbol alongside the number.
     */
    enum QuantityUnit {
        GRAMS,      // 0 — small batches (e.g. premium fruit boxes)
        KILOGRAMS   // 1 — bulk produce
    }


    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Core metadata for a registered produce batch.
     * @dev    Stored in a mapping keyed by the deterministic batchId (keccak256 hash).
     *         `exists` is used as a presence-check sentinel instead of a zero-address
     *         comparison, making the intent explicit.
     */
    struct Batch {
        string       productName; // Human-readable name, e.g. "Da Lat Strawberry"
        string       origin;      // Geographic origin, e.g. "Da Lat, Lam Dong"
        uint256      harvestDate; // Unix timestamp (seconds) of the harvest date
        uint256      quantity;    // Numeric weight, interpreted with `unit` below
        QuantityUnit unit;        // GRAMS or KILOGRAMS — disambiguates `quantity`
        address      producer;    // Wallet address of the registering producer
        bool         ocop;        // True if the batch carries an OCOP quality certification
        bool         exists;      // Sentinel: true once the batch has been registered
        bool         flagged;     // True if an auditor has raised a concern on this batch
        string       ipfsHash;    // Pinata/IPFS CID for the product photo or certificate
    }

    /**
     * @notice A single supply-chain event appended to a batch's history.
     * @dev    Two kinds of checkpoints share this struct:
     *           1. Main-flow checkpoints (addonLabel == ""): subject to forward-only
     *              ordering enforced by logCheckpoint().
     *           2. Add-on checkpoints (addonLabel != ""): custom named steps (e.g.
     *              "Quality Check", "Cold Storage") logged via logAddon() that do NOT
     *              affect the forward-only ordering of the main flow.
     *         Sharing one struct keeps getHistory() simple and the timeline chronological.
     */
    struct Checkpoint {
        address    actor;      // Wallet address of the participant who logged this event
        string     location;   // Physical location where the event occurred
        uint256    timestamp;  // block.timestamp at the time of logging (unix seconds)
        ActionType action;     // Lifecycle stage (ignored for add-on checkpoints)
        string     ipfsHash;   // Optional CID for photo evidence (empty string if none)
        string     addonLabel; // Non-empty string identifies this as an add-on step
    }

    /**
     * @notice A quality or safety concern raised by an auditor.
     * @dev    Flags are informational only — they do not block further checkpoint logging.
     *         Multiple flags can accumulate on the same batch from different auditors.
     *         A flag can be resolved once the concern is addressed, which clears
     *         batch.flagged if no other unresolved flags remain.
     */
    struct AuditFlag {
        address auditor;    // Wallet of the auditor who raised the flag
        string  reason;     // Free-text description of the concern
        uint256 timestamp;  // When the flag was raised (unix seconds)
        bool    resolved;   // True once an auditor marks the concern as addressed
        address resolvedBy; // Wallet that resolved the flag (zero address if unresolved)
        uint256 resolvedAt; // When the flag was resolved (0 if unresolved)
    }


    // ─────────────────────────────────────────────────────────────────────────
    // State variables
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Primary store: batchId → Batch metadata.
    mapping(bytes32 => Batch) private batches;

    /// @dev Append-only event log per batch. New entries are pushed; none are removed.
    mapping(bytes32 => Checkpoint[]) private checkpoints;

    /// @dev Audit flags per batch, accumulated over time.
    mapping(bytes32 => AuditFlag[]) private auditFlags;

    /// @dev Ordered list of all registered batchIds — used by getBatchIds() for enumeration.
    bytes32[] private batchIds;

    // ─────────────────────────────────────────────────────────────────────────
    // Input-validation constants
    // Length caps protect against unbounded-string gas attacks; date caps
    // catch obvious user errors (timestamp far in past or future).
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private constant MAX_NAME_LEN     = 100;
    uint256 private constant MAX_LOCATION_LEN = 200;
    uint256 private constant MAX_REASON_LEN   = 500;
    uint256 private constant MAX_LABEL_LEN    = 100;
    uint256 private constant MAX_IPFS_LEN     = 100;

    /// @dev Reject harvest dates older than 100 years before now or more than
    ///      30 days in the future — protects against accidental date errors.
    uint256 private constant MAX_HARVEST_LOOKBACK = 100 * 365 days;
    uint256 private constant MAX_HARVEST_LOOKAHEAD = 30 days;


    // ─────────────────────────────────────────────────────────────────────────
    // Custom errors (gas-efficient vs. revert strings; carry typed arguments)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Emitted by logCheckpoint() when the requested action would move the
     *      batch backwards or stay at the same stage.
     * @param batchId   The batch on which the anomaly was detected.
     * @param attempted The action the caller tried to log.
     * @param last      The last successfully recorded main-flow action.
     */
    error AnomalyDetected(bytes32 batchId, ActionType attempted, ActionType last);

    /// @dev Thrown whenever a function receives a batchId that has not been registered.
    error BatchNotFound(bytes32 batchId);

    /// @dev Thrown by registerBatch() when a deterministic collision is detected.
    error BatchAlreadyExists(bytes32 batchId);


    // ─────────────────────────────────────────────────────────────────────────
    // Events (indexed fields enable efficient off-chain filtering)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new batch is registered on-chain.
    event BatchRegistered(
        bytes32 indexed batchId,
        string productName,
        string origin,
        address producer
    );

    /// @notice Emitted after a successful main-flow checkpoint.
    event CheckpointLogged(
        bytes32 indexed batchId,
        address actor,
        ActionType action,
        string location
    );

    /// @notice Emitted when an auditor flags a batch for review.
    event BatchFlagged(
        bytes32 indexed batchId,
        address auditor,
        string reason
    );

    /// @notice Emitted when an auditor marks a flag as resolved.
    event FlagResolved(
        bytes32 indexed batchId,
        address resolvedBy,
        uint256 flagIndex
    );

    /// @notice Emitted when an add-on (custom) process step is logged.
    event AddonLogged(
        bytes32 indexed batchId,
        address actor,
        string addonLabel,
        string location
    );


    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Grants DEFAULT_ADMIN_ROLE to the deploying address so that it can
     *      subsequently grant PRODUCER_ROLE, LOGISTICS_ROLE, etc. to participants
     *      via grantRole() without requiring any contract redeployment.
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // Write functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Registers a new produce batch and automatically records the
     *         initial HARVESTED checkpoint.
     * @dev    Access: PRODUCER_ROLE only.
     *
     *         The batchId is a keccak256 hash of (productName, origin, harvestDate,
     *         msg.sender, block.timestamp). Using the timestamp as part of the seed
     *         allows the same producer to register two batches of the same product
     *         on different days without collision.
     *
     *         The HARVESTED checkpoint is inserted atomically with the batch so that
     *         getHistory() always returns at least one checkpoint, simplifying
     *         front-end rendering logic.
     *
     * @param productName Human-readable name of the agricultural product.
     * @param origin      Geographic provenance of the batch.
     * @param harvestDate Unix timestamp (seconds) of the actual harvest date.
     * @param quantity    Batch weight in grams.
     * @param ocop        Whether the product holds OCOP certification.
     * @param ipfsHash    Pinata CID for the product image or certificate (may be empty).
     * @return batchId    The unique bytes32 identifier for the newly registered batch.
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

        // ── Input validation ──
        // Reject empty + oversized strings to keep storage bounded and prevent
        // gas-griefing attacks via huge string parameters.
        require(bytes(productName).length > 0,                      "productName required");
        require(bytes(productName).length <= MAX_NAME_LEN,          "productName too long");
        require(bytes(origin).length > 0,                           "origin required");
        require(bytes(origin).length <= MAX_NAME_LEN,               "origin too long");
        require(bytes(ipfsHash).length <= MAX_IPFS_LEN,             "ipfsHash too long");
        require(quantity > 0,                                       "quantity must be > 0");

        // Sanity-check harvestDate so producers can't accidentally enter year
        // 1970 (timestamp 0) or a date decades in the future.
        require(harvestDate + MAX_HARVEST_LOOKBACK >= block.timestamp, "harvestDate too old");
        require(harvestDate <= block.timestamp + MAX_HARVEST_LOOKAHEAD, "harvestDate too far in future");

        // Derive a deterministic, collision-resistant batch ID from the inputs.
        // Uses abi.encode (NOT encodePacked) on dynamic types so concatenated
        // strings cannot collide: ("ab","cd") and ("a","bcd") would otherwise
        // hash identically under encodePacked.
        bytes32 batchId = keccak256(
            abi.encode(productName, origin, harvestDate, msg.sender, block.timestamp)
        );

        // Guard against hash collisions (extremely rare but theoretically possible).
        if (batches[batchId].exists) {
            revert BatchAlreadyExists(batchId);
        }

        // Persist the batch metadata to on-chain storage.
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

        // Track the ID so getBatchIds() can enumerate all batches.
        batchIds.push(batchId);

        // Automatically open the audit trail with a HARVESTED checkpoint.
        // This ensures the very first entry is always at stage 0, which the
        // forward-only check in logCheckpoint() compares against.
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
     * @notice Appends a main-flow supply-chain checkpoint to an existing batch.
     * @dev    Access: LOGISTICS_ROLE or RETAILER_ROLE.
     *
     *         Forward-only enforcement: the uint value of `action` must be strictly
     *         greater than the last main-flow action stored in the checkpoint array.
     *         Add-on checkpoints (addonLabel != "") store ActionType.HARVESTED (0)
     *         as a placeholder and must be skipped by the ordering comparison.
     *
     *         The comparison iterates only the last element (O(1)) because the
     *         array is always appended in chronological order and we only need the
     *         most recent main-flow stage to validate the next step.
     *
     * @param batchId  The batch to update.
     * @param action   The lifecycle stage being recorded (PROCESSED=1 … RECEIVED=4).
     * @param location Physical location where this stage occurred.
     * @param ipfsHash Optional Pinata CID for photographic evidence (empty if none).
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

        // ── Input validation ──
        require(bytes(location).length > 0,                "location required");
        require(bytes(location).length <= MAX_LOCATION_LEN, "location too long");
        require(bytes(ipfsHash).length <= MAX_IPFS_LEN,     "ipfsHash too long");

        if (!batches[batchId].exists) revert BatchNotFound(batchId);

        // Enforce forward-only ordering by comparing against the last checkpoint.
        // Note: add-on checkpoints use ActionType.HARVESTED (0) as a placeholder;
        // we compare against the LAST element regardless — for the forward-only
        // rule to hold correctly, logAddon() stores action=HARVESTED but the
        // comparison still uses the integer value of the last main-flow action
        // because add-ons are always inserted between main-flow steps and their
        // placeholder value (0) would falsely block the next main-flow step.
        //
        // IMPORTANT: the ordering comparison intentionally examines the last array
        // element, which could be an add-on. An add-on stores action=HARVESTED (0),
        // so any main-flow action (≥1) would pass the `> lastAction` check even
        // after an add-on — this is the intended behavior.
        Checkpoint[] storage cps = checkpoints[batchId];
        if (cps.length > 0) {
            // Walk backwards to find the last MAIN-FLOW checkpoint for comparison.
            // This ensures add-on placeholders do not interfere with ordering.
            for (uint256 i = cps.length; i > 0; i--) {
                if (bytes(cps[i - 1].addonLabel).length == 0) {
                    // Found the last main-flow checkpoint.
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
            addonLabel: "" // Empty string marks this as a main-flow checkpoint.
        }));

        emit CheckpointLogged(batchId, msg.sender, action, location);
    }

    /**
     * @notice Appends a custom add-on process step that sits outside the main
     *         HARVESTED→RECEIVED lifecycle order.
     * @dev    Access: any of the four roles (all participants may log add-ons).
     *
     *         Use-cases: "Quality Lab Test", "Cold Storage Entry", "Fumigation",
     *         "Re-packaging" — steps that are real supply-chain events but do not
     *         map cleanly to the five main ActionType stages.
     *
     *         Add-ons store ActionType.HARVESTED (0) as a placeholder value because
     *         the `action` field is irrelevant for add-ons. The addonLabel string
     *         is what distinguishes them from main-flow checkpoints in the UI.
     *
     * @param batchId    The batch to annotate.
     * @param addonLabel Descriptive name for the custom process step (must be non-empty).
     * @param location   Where the add-on process took place (may be empty).
     * @param ipfsHash   Optional evidence CID (may be empty).
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

        // ── Input validation ──
        require(bytes(addonLabel).length > 0,                "addonLabel required");
        require(bytes(addonLabel).length <= MAX_LABEL_LEN,   "addonLabel too long");
        require(bytes(location).length <= MAX_LOCATION_LEN,  "location too long");
        require(bytes(ipfsHash).length <= MAX_IPFS_LEN,      "ipfsHash too long");

        checkpoints[batchId].push(Checkpoint({
            actor:      msg.sender,
            location:   location,
            timestamp:  block.timestamp,
            action:     ActionType.HARVESTED, // Placeholder — not used for add-ons.
            ipfsHash:   ipfsHash,
            addonLabel: addonLabel
        }));

        emit AddonLogged(batchId, msg.sender, addonLabel, location);
    }

    /**
     * @notice Raises a quality or safety concern on a batch (warning only).
     * @dev    Access: AUDITOR_ROLE only.
     *
     *         Flagging sets batch.flagged = true and appends an AuditFlag record.
     *         It does NOT block further checkpoint logging — the supply chain
     *         continues so goods already in transit are not stranded. The flag is
     *         surfaced prominently in the UI (FlaggedBanner component) so all
     *         participants are aware of the concern.
     *
     *         Multiple auditors may flag the same batch; all flags are retained.
     *
     * @param batchId The batch to flag.
     * @param reason  Free-text description of the concern (e.g. "Temperature excursion").
     */
    function flagBatch(
        bytes32 batchId,
        string calldata reason
    ) external onlyRole(AUDITOR_ROLE) {
        if (!batches[batchId].exists) revert BatchNotFound(batchId);

        // ── Input validation ──
        require(bytes(reason).length > 0,              "reason required");
        require(bytes(reason).length <= MAX_REASON_LEN, "reason too long");

        // Mark the batch so the flagged state is visible via getHistory().
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


    // ─────────────────────────────────────────────────────────────────────────
    // View functions (read-only; no gas cost when called off-chain)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Marks an existing audit flag as resolved once the concern is addressed.
     * @dev    Access: AUDITOR_ROLE only.
     *
     *         After resolution, batch.flagged is recomputed: if all flags are resolved
     *         the batch is no longer considered flagged, removing the warning banner
     *         from the consumer-facing trace page.
     *
     * @param batchId   The batch whose flag is being resolved.
     * @param flagIndex Index into the auditFlags array for this batch.
     */
    function resolveFlag(bytes32 batchId, uint256 flagIndex) external onlyRole(AUDITOR_ROLE) {
        if (!batches[batchId].exists) revert BatchNotFound(batchId);
        require(flagIndex < auditFlags[batchId].length, "Invalid flag index");
        require(!auditFlags[batchId][flagIndex].resolved, "Flag already resolved");

        auditFlags[batchId][flagIndex].resolved   = true;
        auditFlags[batchId][flagIndex].resolvedBy = msg.sender;
        auditFlags[batchId][flagIndex].resolvedAt = block.timestamp;

        // Recompute batch.flagged: stays true only if any unresolved flag remains.
        bool anyUnresolved = false;
        for (uint256 i = 0; i < auditFlags[batchId].length; i++) {
            if (!auditFlags[batchId][i].resolved) { anyUnresolved = true; break; }
        }
        batches[batchId].flagged = anyUnresolved;

        emit FlagResolved(batchId, msg.sender, flagIndex);
    }

    /**
     * @notice Returns the complete traceability record for a batch in a single call.
     * @dev    Returns all three data types together to minimise RPC round-trips from
     *         the front-end. Consumers, auditors, and logistics operators all use
     *         this function to verify provenance and supply-chain history.
     *
     * @param  batchId The batch to query (must exist).
     * @return batch       The Batch metadata struct.
     * @return cps         The full ordered Checkpoint array (main-flow + add-ons).
     * @return flags       All AuditFlag records raised on this batch.
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
     * @notice Returns all registered batch IDs so the Dashboard can enumerate batches.
     * @dev    Returned in registration order. No pagination yet — acceptable for the
     *         current pilot scale (Vietnam OCOP producers are limited in number).
     */
    function getBatchIds() external view returns (bytes32[] memory) {
        return batchIds;
    }

    /**
     * @notice Returns the total number of registered batches.
     * @dev    Useful for analytics and for checking whether enumeration is needed
     *         before calling the more expensive getBatchIds().
     */
    function getBatchCount() external view returns (uint256) {
        return batchIds.length;
    }
}
