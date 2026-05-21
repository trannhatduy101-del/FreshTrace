import { expect } from "chai";
import { ethers } from "hardhat";
import { FreshTrace } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("FreshTrace", function () {
  let freshTrace: FreshTrace;
  let admin: HardhatEthersSigner;
  let producer: HardhatEthersSigner;
  let logistics: HardhatEthersSigner;
  let retailer: HardhatEthersSigner;
  let auditor: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;

  // Role hashes, must match the contract constants
  let PRODUCER_ROLE: string;
  let LOGISTICS_ROLE: string;
  let RETAILER_ROLE: string;
  let AUDITOR_ROLE: string;

  // Reusable batch registration helper
  async function registerTestBatch(
    ipfsHash: string = "QmTestHash123"
  ): Promise<string> {
    // Use a recent timestamp (now - 1 day) so the validation passes
    const harvestDate = Math.floor(Date.now() / 1000) - 86400;
    const tx = await freshTrace
      .connect(producer)
      .registerBatch(
        "Mango",
        "Dong Thap",
        harvestDate,
        500000,
        0, // QuantityUnit.GRAMS
        true,
        ipfsHash
      );
    const receipt = await tx.wait();
    // Extract batchId from BatchRegistered event
    const event = receipt?.logs.find((log) => {
      try {
        return freshTrace.interface.parseLog(log as any)?.name === "BatchRegistered";
      } catch {
        return false;
      }
    });
    const parsed = freshTrace.interface.parseLog(event as any);
    return parsed!.args.batchId;
  }

  beforeEach(async function () {
    [admin, producer, logistics, retailer, auditor, unauthorized] =
      await ethers.getSigners();

    const FreshTraceFactory = await ethers.getContractFactory("FreshTrace");
    freshTrace = await FreshTraceFactory.deploy();
    await freshTrace.waitForDeployment();

    // Cache role hashes
    PRODUCER_ROLE = await freshTrace.PRODUCER_ROLE();
    LOGISTICS_ROLE = await freshTrace.LOGISTICS_ROLE();
    RETAILER_ROLE = await freshTrace.RETAILER_ROLE();
    AUDITOR_ROLE = await freshTrace.AUDITOR_ROLE();

    // Grant roles to test accounts
    await freshTrace.grantRole(PRODUCER_ROLE, producer.address);
    await freshTrace.grantRole(LOGISTICS_ROLE, logistics.address);
    await freshTrace.grantRole(RETAILER_ROLE, retailer.address);
    await freshTrace.grantRole(AUDITOR_ROLE, auditor.address);
  });

  // Deployment

  describe("Deployment", function () {
    it("Should set deployer as DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN = await freshTrace.DEFAULT_ADMIN_ROLE();
      expect(await freshTrace.hasRole(DEFAULT_ADMIN, admin.address)).to.be.true;
    });

    it("Should grant all roles correctly", async function () {
      expect(await freshTrace.hasRole(PRODUCER_ROLE, producer.address)).to.be
        .true;
      expect(await freshTrace.hasRole(LOGISTICS_ROLE, logistics.address)).to.be
        .true;
      expect(await freshTrace.hasRole(RETAILER_ROLE, retailer.address)).to.be
        .true;
      expect(await freshTrace.hasRole(AUDITOR_ROLE, auditor.address)).to.be
        .true;
    });
  });

  // registerBatch

  describe("registerBatch", function () {
    it("Should register batch and auto-create HARVESTED checkpoint", async function () {
      const batchId = await registerTestBatch();
      const [batch, cps] = await freshTrace.getHistory(batchId);

      expect(batch.exists).to.be.true;
      expect(batch.productName).to.equal("Mango");
      expect(cps.length).to.equal(1);
      // ActionType.HARVESTED = 0
      expect(cps[0].action).to.equal(0);
    });

    it("Should emit BatchRegistered with correct params", async function () {
      await expect(
        freshTrace
          .connect(producer)
          .registerBatch("Mango", "Dong Thap", 1700000000, 500000, 0, true, "QmHash")
      )
        .to.emit(freshTrace, "BatchRegistered")
        .withArgs(
          // batchId is dynamic, so we just check it was emitted
          (batchId: string) => typeof batchId === "string",
          "Mango",
          "Dong Thap",
          producer.address
        );
    });

    it("getHistory should return 1 checkpoint with HARVESTED", async function () {
      const batchId = await registerTestBatch();
      const [, cps] = await freshTrace.getHistory(batchId);

      expect(cps.length).to.equal(1);
      expect(cps[0].action).to.equal(0); // HARVESTED
    });

    it("checkpoint[0].actor should equal producer address", async function () {
      const batchId = await registerTestBatch();
      const [, cps] = await freshTrace.getHistory(batchId);

      expect(cps[0].actor).to.equal(producer.address);
    });

    it("Should store ipfsHash in Batch struct", async function () {
      const batchId = await registerTestBatch("QmSpecificCID");
      const [batch] = await freshTrace.getHistory(batchId);

      expect(batch.ipfsHash).to.equal("QmSpecificCID");
    });

    it("Should revert for non-PRODUCER_ROLE", async function () {
      await expect(
        freshTrace
          .connect(unauthorized)
          .registerBatch("Mango", "Dong Thap", 1700000000, 500000, 0, true, "")
      ).to.be.reverted;
    });
  });

  // logCheckpoint

  describe("logCheckpoint", function () {
    let batchId: string;

    beforeEach(async function () {
      batchId = await registerTestBatch();
    });

    it("Should log PROCESSED after HARVESTED (1 > 0)", async function () {
      await freshTrace
        .connect(logistics)
        .logCheckpoint(batchId, 1, "Can Tho Hub", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(2);
      expect(cps[1].action).to.equal(1); // PROCESSED
    });

    it("Should log SHIPPED after PROCESSED (skipping PACKED, forward skip is allowed)", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Can Tho Hub", "");
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "HCMC Warehouse", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[2].action).to.equal(3); // SHIPPED
    });

    it("Should log RECEIVED after SHIPPED (4 > 3)", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "HCMC Warehouse", "");
      await freshTrace.connect(retailer).logCheckpoint(batchId, 4, "Saigon Mart", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[2].action).to.equal(4); // RECEIVED
    });

    it("Should store checkpoint ipfsHash correctly", async function () {
      await freshTrace
        .connect(logistics)
        .logCheckpoint(batchId, 1, "Can Tho Hub", "QmCheckpointEvidence");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[1].ipfsHash).to.equal("QmCheckpointEvidence");
    });

    it("Should accept empty ipfsHash", async function () {
      await freshTrace
        .connect(logistics)
        .logCheckpoint(batchId, 1, "Can Tho Hub", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[1].ipfsHash).to.equal("");
    });

    it("Should revert AnomalyDetected on RECEIVED -> SHIPPED (backward)", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "HCMC", "");
      await freshTrace.connect(retailer).logCheckpoint(batchId, 4, "Store", "");

      await expect(
        freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Warehouse", "")
      )
        .to.be.revertedWithCustomError(freshTrace, "AnomalyDetected")
        .withArgs(batchId, 3, 4);
    });

    it("Should revert AnomalyDetected on SHIPPED -> SHIPPED (duplicate)", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "HCMC", "");

      await expect(
        freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Again", "")
      )
        .to.be.revertedWithCustomError(freshTrace, "AnomalyDetected")
        .withArgs(batchId, 3, 3);
    });

    it("Should revert BatchNotFound for non-existent batch", async function () {
      const fakeBatchId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));

      await expect(
        freshTrace
          .connect(logistics)
          .logCheckpoint(fakeBatchId, 1, "Nowhere", "")
      )
        .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
        .withArgs(fakeBatchId);
    });

    it("Should revert for unauthorized account", async function () {
      await expect(
        freshTrace
          .connect(unauthorized)
          .logCheckpoint(batchId, 1, "Can Tho Hub", "")
      ).to.be.reverted;
    });

    it("Should emit CheckpointLogged", async function () {
      await expect(
        freshTrace
          .connect(logistics)
          .logCheckpoint(batchId, 1, "Can Tho Hub", "")
      )
        .to.emit(freshTrace, "CheckpointLogged")
        .withArgs(batchId, logistics.address, 1, "Can Tho Hub");
    });
  });

  // flagBatch

  describe("flagBatch", function () {
    let batchId: string;

    beforeEach(async function () {
      batchId = await registerTestBatch();
    });

    it("Should flag batch (flagged == true)", async function () {
      await freshTrace
        .connect(auditor)
        .flagBatch(batchId, "Suspicious temperature records");

      const [batch] = await freshTrace.getHistory(batchId);
      expect(batch.flagged).to.be.true;
    });

    it("Should emit BatchFlagged", async function () {
      await expect(
        freshTrace
          .connect(auditor)
          .flagBatch(batchId, "Missing certificate")
      )
        .to.emit(freshTrace, "BatchFlagged")
        .withArgs(batchId, auditor.address, "Missing certificate");
    });

    it("Should allow logCheckpoint after flagBatch", async function () {
      // Flagging is warning-only, the supply chain keeps moving.
      await freshTrace
        .connect(auditor)
        .flagBatch(batchId, "Under investigation");

      await freshTrace
        .connect(logistics)
        .logCheckpoint(batchId, 1, "Can Tho Hub", "");

      const [batch, cps] = await freshTrace.getHistory(batchId);
      expect(batch.flagged).to.be.true;
      expect(cps.length).to.equal(2);
    });

    it("Should revert for non-AUDITOR_ROLE", async function () {
      await expect(
        freshTrace
          .connect(unauthorized)
          .flagBatch(batchId, "Trying to flag")
      ).to.be.reverted;
    });
  });

  // getHistory

  describe("getHistory", function () {
    it("Should return complete Batch + Checkpoint[] + AuditFlag[]", async function () {
      const batchId = await registerTestBatch();

      await freshTrace
        .connect(logistics)
        .logCheckpoint(batchId, 1, "Can Tho Hub", "");
      await freshTrace
        .connect(auditor)
        .flagBatch(batchId, "Spot check");

      const [batch, cps, flags] = await freshTrace.getHistory(batchId);

      expect(batch.productName).to.equal("Mango");
      expect(cps.length).to.equal(2);
      expect(flags.length).to.equal(1);
      expect(flags[0].reason).to.equal("Spot check");
    });

    it("Should return correct ipfsHash in Batch", async function () {
      const batchId = await registerTestBatch("QmBatchCertificate");
      const [batch] = await freshTrace.getHistory(batchId);

      expect(batch.ipfsHash).to.equal("QmBatchCertificate");
    });

    it("Should return empty AuditFlag[] for unflagged batch", async function () {
      const batchId = await registerTestBatch();
      const [, , flags] = await freshTrace.getHistory(batchId);

      expect(flags.length).to.equal(0);
    });

    it("Should return multiple checkpoints in order", async function () {
      const batchId = await registerTestBatch();

      await freshTrace
        .connect(logistics)
        .logCheckpoint(batchId, 1, "Can Tho Hub", "");
      await freshTrace
        .connect(logistics)
        .logCheckpoint(batchId, 2, "Packing Facility", "");
      await freshTrace
        .connect(logistics)
        .logCheckpoint(batchId, 3, "HCMC Warehouse", "");
      await freshTrace
        .connect(retailer)
        .logCheckpoint(batchId, 4, "Saigon Mart", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(5);
      // Verify forward-only ordering
      expect(cps[0].action).to.equal(0); // HARVESTED
      expect(cps[1].action).to.equal(1); // PROCESSED
      expect(cps[2].action).to.equal(2); // PACKED
      expect(cps[3].action).to.equal(3); // SHIPPED
      expect(cps[4].action).to.equal(4); // RECEIVED
    });
  });

  // getBatchIds

  describe("getBatchIds", function () {
    it("Should return all batch IDs", async function () {
      const id1 = await registerTestBatch("QmHash1");
      // Need different params or timestamp to get unique batchId
      const tx2 = await freshTrace
        .connect(producer)
        .registerBatch("Dragon Fruit", "Binh Thuan", 1700100000, 300000, 0, true, "QmHash2");
      const receipt2 = await tx2.wait();
      const event2 = receipt2?.logs.find((log) => {
        try {
          return freshTrace.interface.parseLog(log as any)?.name === "BatchRegistered";
        } catch {
          return false;
        }
      });
      const id2 = freshTrace.interface.parseLog(event2 as any)!.args.batchId;

      const ids = await freshTrace.getBatchIds();
      expect(ids.length).to.equal(2);
      expect(ids).to.include(id1);
      expect(ids).to.include(id2);
    });

    it("Should return empty array initially", async function () {
      // Deploy a fresh contract to test empty state
      const Factory = await ethers.getContractFactory("FreshTrace");
      const fresh = await Factory.deploy();
      await fresh.waitForDeployment();

      const ids = await fresh.getBatchIds();
      expect(ids.length).to.equal(0);
    });
  });

  // getBatchCount

  describe("getBatchCount", function () {
    it("Should return 0 before any registration", async function () {
      expect(await freshTrace.getBatchCount()).to.equal(0);
    });

    it("Should increment count with each registration", async function () {
      await registerTestBatch("QmA");
      expect(await freshTrace.getBatchCount()).to.equal(1);

      await freshTrace
        .connect(producer)
        .registerBatch("Lychee", "Bac Giang", 1700200000, 200000, 0, false, "QmB");
      expect(await freshTrace.getBatchCount()).to.equal(2);
    });
  });

  // Edge cases

  describe("Edge Cases -getHistory on missing batch", function () {
    it("Should revert BatchNotFound for non-existent batchId", async function () {
      const fake = ethers.keccak256(ethers.toUtf8Bytes("ghost-batch"));
      await expect(freshTrace.getHistory(fake))
        .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
        .withArgs(fake);
    });
  });

  describe("Edge Cases -flagBatch", function () {
    it("Should revert BatchNotFound when flagging non-existent batch", async function () {
      const fake = ethers.keccak256(ethers.toUtf8Bytes("ghost-batch"));
      await expect(freshTrace.connect(auditor).flagBatch(fake, "Ghost flag"))
        .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
        .withArgs(fake);
    });

    it("Should accumulate multiple flags from multiple auditors", async function () {
      const batchId = await registerTestBatch();

      // Grant AUDITOR_ROLE to a second auditor account
      const [, , , , , , secondAuditor] = await ethers.getSigners();
      await freshTrace.grantRole(AUDITOR_ROLE, secondAuditor.address);

      await freshTrace.connect(auditor).flagBatch(batchId, "Temperature excursion");
      await freshTrace.connect(secondAuditor).flagBatch(batchId, "Missing OCOP cert");

      const [batch, , flags] = await freshTrace.getHistory(batchId);
      expect(batch.flagged).to.be.true;
      expect(flags.length).to.equal(2);
      expect(flags[0].reason).to.equal("Temperature excursion");
      expect(flags[1].reason).to.equal("Missing OCOP cert");
    });

    it("Should store correct auditor address in AuditFlag", async function () {
      const batchId = await registerTestBatch();
      await freshTrace.connect(auditor).flagBatch(batchId, "Spot check");

      const [, , flags] = await freshTrace.getHistory(batchId);
      expect(flags[0].auditor).to.equal(auditor.address);
    });

    it("Should allow re-flagging an already-flagged batch", async function () {
      const batchId = await registerTestBatch();
      await freshTrace.connect(auditor).flagBatch(batchId, "First flag");
      await freshTrace.connect(auditor).flagBatch(batchId, "Second flag");

      const [batch, , flags] = await freshTrace.getHistory(batchId);
      expect(batch.flagged).to.be.true;
      expect(flags.length).to.equal(2);
    });
  });

  describe("Edge Cases -logCheckpoint anomalies", function () {
    let batchId: string;

    beforeEach(async function () {
      batchId = await registerTestBatch();
    });

    it("Should revert AnomalyDetected when logging HARVESTED via logCheckpoint", async function () {
      // HARVESTED(0) <= HARVESTED(0), counts as backward-or-equal
      await expect(
        freshTrace.connect(logistics).logCheckpoint(batchId, 0, "Farm", "")
      )
        .to.be.revertedWithCustomError(freshTrace, "AnomalyDetected")
        .withArgs(batchId, 0, 0);
    });

    it("Should revert AnomalyDetected on PROCESSED -> HARVESTED (backward)", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Hub", "");
      await expect(
        freshTrace.connect(logistics).logCheckpoint(batchId, 0, "Farm", "")
      )
        .to.be.revertedWithCustomError(freshTrace, "AnomalyDetected")
        .withArgs(batchId, 0, 1);
    });

    it("Should revert AnomalyDetected on RECEIVED -> PROCESSED (backward)", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Hub", "");
      await freshTrace.connect(retailer).logCheckpoint(batchId, 4, "Store", "");
      await expect(
        freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Hub", "")
      )
        .to.be.revertedWithCustomError(freshTrace, "AnomalyDetected")
        .withArgs(batchId, 1, 4);
    });

    it("Producer (not logistics/retailer) cannot logCheckpoint", async function () {
      await expect(
        freshTrace.connect(producer).logCheckpoint(batchId, 1, "Nowhere", "")
      ).to.be.reverted;
    });

    it("Auditor (not logistics/retailer) cannot logCheckpoint", async function () {
      await expect(
        freshTrace.connect(auditor).logCheckpoint(batchId, 1, "Nowhere", "")
      ).to.be.reverted;
    });

    it("Retailer can log RECEIVED (end of chain)", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "HCMC", "");
      await freshTrace.connect(retailer).logCheckpoint(batchId, 4, "Store", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[cps.length - 1].action).to.equal(4); // RECEIVED
      expect(cps[cps.length - 1].actor).to.equal(retailer.address);
    });
  });

  describe("Edge Cases -data integrity", function () {
    it("Should store ocop=false correctly", async function () {
      const tx = await freshTrace
        .connect(producer)
        .registerBatch("Plain Rice", "An Giang", 1700300000, 1000000, 0, false, "");
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try { return freshTrace.interface.parseLog(log as any)?.name === "BatchRegistered"; }
        catch { return false; }
      });
      const batchId = freshTrace.interface.parseLog(event as any)!.args.batchId;

      const [batch] = await freshTrace.getHistory(batchId);
      expect(batch.ocop).to.be.false;
    });

    it("Should store large quantity (uint256 max-safe)", async function () {
      const largeQty = 999_999_999_999n;
      const tx = await freshTrace
        .connect(producer)
        .registerBatch("Bulk Corn", "Dak Lak", 1700400000, largeQty, 1, false, "");
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try { return freshTrace.interface.parseLog(log as any)?.name === "BatchRegistered"; }
        catch { return false; }
      });
      const batchId = freshTrace.interface.parseLog(event as any)!.args.batchId;

      const [batch] = await freshTrace.getHistory(batchId);
      expect(batch.quantity).to.equal(largeQty);
    });

    it("Checkpoint timestamp should be a recent block timestamp", async function () {
      const batchId = await registerTestBatch();
      const [, cps] = await freshTrace.getHistory(batchId);

      const now = BigInt(Math.floor(Date.now() / 1000));
      const diff = now - cps[0].timestamp;
      // Allow up to 60 seconds drift in either direction
      expect(diff).to.be.lessThan(60n);
    });

    it("Logistics actor address stored correctly in checkpoint", async function () {
      const batchId = await registerTestBatch();
      await freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Hub", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[1].actor).to.equal(logistics.address);
    });

    it("Should allow forward-skip (HARVESTED -> SHIPPED, skipping PROCESSED and PACKED)", async function () {
      const batchId = await registerTestBatch();
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Direct ship", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(2);
      expect(cps[1].action).to.equal(3);
    });
  });

  // logAddon

  describe("logAddon", function () {
    let batchId: string;

    beforeEach(async function () {
      batchId = await registerTestBatch();
    });

    it("Logistics can log an add-on checkpoint", async function () {
      await freshTrace.connect(logistics).logAddon(batchId, "Quality Check", "Lab HCM", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(2);
      expect(cps[1].addonLabel).to.equal("Quality Check");
      expect(cps[1].location).to.equal("Lab HCM");
      expect(cps[1].actor).to.equal(logistics.address);
    });

    it("Producer can log an add-on checkpoint", async function () {
      await freshTrace.connect(producer).logAddon(batchId, "Pesticide Test", "Farm Lab", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[1].addonLabel).to.equal("Pesticide Test");
      expect(cps[1].actor).to.equal(producer.address);
    });

    it("Retailer can log an add-on checkpoint", async function () {
      await freshTrace.connect(retailer).logAddon(batchId, "Shelf Placement", "Aeon Mall", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[1].addonLabel).to.equal("Shelf Placement");
    });

    it("Auditor can log an add-on checkpoint", async function () {
      await freshTrace.connect(auditor).logAddon(batchId, "Audit Spot Check", "Warehouse", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[1].addonLabel).to.equal("Audit Spot Check");
    });

    it("Unauthorized account cannot log add-on", async function () {
      await expect(
        freshTrace.connect(unauthorized).logAddon(batchId, "Fake Step", "Nowhere", "")
      ).to.be.revertedWith("No authorized role");
    });

    it("Should revert when addonLabel is empty", async function () {
      await expect(
        freshTrace.connect(logistics).logAddon(batchId, "", "Lab", "")
      ).to.be.revertedWith("addonLabel required");
    });

    it("Should revert BatchNotFound for non-existent batch", async function () {
      const fake = ethers.keccak256(ethers.toUtf8Bytes("no-such-batch"));
      await expect(
        freshTrace.connect(logistics).logAddon(fake, "Step", "Loc", "")
      )
        .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
        .withArgs(fake);
    });

    it("Add-on does not affect main flow order validation", async function () {
      // Log add-on, then main checkpoint should still validate against last main action
      await freshTrace.connect(logistics).logAddon(batchId, "Cold Storage", "Warehouse", "");
      // Can still go PROCESSED (1): the add-on at index 1 has action=HARVESTED(0) but addonLabel set
      await freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Factory", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(3);
      expect(cps[1].addonLabel).to.equal("Cold Storage");
      expect(cps[2].action).to.equal(1); // PROCESSED
    });

    it("Add-on between main steps cannot allow backward main-flow step", async function () {
      // SHIPPED(3) -> add-on -> PROCESSED(1) must still revert
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Port", "");
      await freshTrace.connect(logistics).logAddon(batchId, "Customs Check", "Port", "");
      await expect(
        freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Factory", "")
      )
        .to.be.revertedWithCustomError(freshTrace, "AnomalyDetected")
        .withArgs(batchId, 1, 3);
    });

    it("Multiple add-ons can be logged between main checkpoints", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Factory", "");
      await freshTrace.connect(logistics).logAddon(batchId, "QC Pass", "Lab", "");
      await freshTrace.connect(logistics).logAddon(batchId, "Repack", "Packing Floor", "");
      await freshTrace.connect(logistics).logCheckpoint(batchId, 2, "Warehouse", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(5); // HARVESTED + PROCESSED + 2 add-ons + PACKED
      expect(cps[2].addonLabel).to.equal("QC Pass");
      expect(cps[3].addonLabel).to.equal("Repack");
      expect(cps[4].action).to.equal(2); // PACKED
    });

    it("Add-on emits AddonLogged event with correct args", async function () {
      await expect(
        freshTrace.connect(logistics).logAddon(batchId, "Fumigation", "Port", "QmCID")
      )
        .to.emit(freshTrace, "AddonLogged")
        .withArgs(batchId, logistics.address, "Fumigation", "Port");
    });

    it("Add-on stores ipfsHash correctly", async function () {
      await freshTrace.connect(logistics).logAddon(batchId, "Lab Report", "Lab", "QmEvidence123");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps[1].ipfsHash).to.equal("QmEvidence123");
    });
  });

  // resolveFlag

  describe("resolveFlag", function () {
    let batchId: string;

    beforeEach(async function () {
      batchId = await registerTestBatch();
      await freshTrace.connect(auditor).flagBatch(batchId, "Temperature excursion");
    });

    it("Auditor can resolve a flag", async function () {
      await freshTrace.connect(auditor).resolveFlag(batchId, 0);

      const [batch, , flags] = await freshTrace.getHistory(batchId);
      expect(flags[0].resolved).to.be.true;
      expect(flags[0].resolvedBy).to.equal(auditor.address);
      expect(flags[0].resolvedAt).to.be.greaterThan(0n);
      // batch.flagged cleared because no unresolved flags remain
      expect(batch.flagged).to.be.false;
    });

    it("Resolving one of two flags keeps batch.flagged true", async function () {
      await freshTrace.connect(auditor).flagBatch(batchId, "Second issue");
      await freshTrace.connect(auditor).resolveFlag(batchId, 0);

      const [batch, , flags] = await freshTrace.getHistory(batchId);
      expect(flags[0].resolved).to.be.true;
      expect(flags[1].resolved).to.be.false;
      expect(batch.flagged).to.be.true; // second flag still open
    });

    it("Resolving all flags clears batch.flagged", async function () {
      await freshTrace.connect(auditor).flagBatch(batchId, "Second issue");
      await freshTrace.connect(auditor).resolveFlag(batchId, 0);
      await freshTrace.connect(auditor).resolveFlag(batchId, 1);

      const [batch] = await freshTrace.getHistory(batchId);
      expect(batch.flagged).to.be.false;
    });

    it("Cannot resolve an already-resolved flag", async function () {
      await freshTrace.connect(auditor).resolveFlag(batchId, 0);
      await expect(freshTrace.connect(auditor).resolveFlag(batchId, 0))
        .to.be.revertedWith("Flag already resolved");
    });

    it("Reverts with invalid flag index", async function () {
      await expect(freshTrace.connect(auditor).resolveFlag(batchId, 99))
        .to.be.revertedWith("Invalid flag index");
    });

    it("Non-auditor cannot resolve a flag", async function () {
      await expect(freshTrace.connect(logistics).resolveFlag(batchId, 0))
        .to.be.reverted;
    });

    it("Emits FlagResolved event", async function () {
      await expect(freshTrace.connect(auditor).resolveFlag(batchId, 0))
        .to.emit(freshTrace, "FlagResolved")
        .withArgs(batchId, auditor.address, 0);
    });

    it("Reverts BatchNotFound for non-existent batch", async function () {
      const fake = ethers.keccak256(ethers.toUtf8Bytes("ghost"));
      await expect(freshTrace.connect(auditor).resolveFlag(fake, 0))
        .to.be.revertedWithCustomError(freshTrace, "BatchNotFound");
    });
  });

  // Input validation

  describe("Input validation", function () {
    const validDate = () => Math.floor(Date.now() / 1000) - 86400;

    it("registerBatch rejects empty productName", async function () {
      await expect(
        freshTrace.connect(producer).registerBatch("", "Origin", validDate(), 100, 0, true, "")
      ).to.be.revertedWith("productName required");
    });

    it("registerBatch rejects productName > 300 bytes", async function () {
      const longName = "a".repeat(301);
      await expect(
        freshTrace.connect(producer).registerBatch(longName, "Origin", validDate(), 100, 0, true, "")
      ).to.be.revertedWith("productName too long");
    });

    it("registerBatch rejects empty origin", async function () {
      await expect(
        freshTrace.connect(producer).registerBatch("Mango", "", validDate(), 100, 0, true, "")
      ).to.be.revertedWith("origin required");
    });

    it("registerBatch rejects quantity == 0", async function () {
      await expect(
        freshTrace.connect(producer).registerBatch("Mango", "Origin", validDate(), 0, 0, true, "")
      ).to.be.revertedWith("quantity must be > 0");
    });

    it("registerBatch rejects harvestDate too far in future", async function () {
      const future = Math.floor(Date.now() / 1000) + 60 * 86400; // 60 days ahead
      await expect(
        freshTrace.connect(producer).registerBatch("Mango", "Origin", future, 100, 0, true, "")
      ).to.be.revertedWith("harvestDate too far in future");
    });

    it("registerBatch accepts harvestDate up to 30 days in future", async function () {
      const future = Math.floor(Date.now() / 1000) + 25 * 86400; // 25 days ahead, within limit
      await expect(
        freshTrace.connect(producer).registerBatch("Mango", "Origin", future, 100, 0, true, "")
      ).to.not.be.reverted;
    });

    it("registerBatch stores QuantityUnit correctly", async function () {
      // GRAMS = 0, KILOGRAMS = 1
      const tx = await freshTrace.connect(producer).registerBatch("Rice", "An Giang", validDate(), 500, 1, false, "");
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try { return freshTrace.interface.parseLog(log as any)?.name === "BatchRegistered"; }
        catch { return false; }
      });
      const batchId = freshTrace.interface.parseLog(event as any)!.args.batchId;

      const [batch] = await freshTrace.getHistory(batchId);
      expect(batch.unit).to.equal(1); // KILOGRAMS
    });

    it("logCheckpoint rejects empty location", async function () {
      const batchId = await registerTestBatch();
      await expect(
        freshTrace.connect(logistics).logCheckpoint(batchId, 1, "", "")
      ).to.be.revertedWith("location required");
    });

    it("flagBatch rejects empty reason", async function () {
      const batchId = await registerTestBatch();
      await expect(
        freshTrace.connect(auditor).flagBatch(batchId, "")
      ).to.be.revertedWith("reason required");
    });

    it("logAddon rejects oversized addonLabel", async function () {
      const batchId = await registerTestBatch();
      const longLabel = "x".repeat(101);
      await expect(
        freshTrace.connect(logistics).logAddon(batchId, longLabel, "Loc", "")
      ).to.be.revertedWith("addonLabel too long");
    });
  });
});
