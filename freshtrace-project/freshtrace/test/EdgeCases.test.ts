import { expect } from "chai";
import { ethers } from "hardhat";
import { FreshTrace } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Exhaustive edge-case suite. Each describe-block targets a category of
 * boundary or stress condition that the main test file does not cover.
 */
describe("FreshTrace — Exhaustive edge cases", function () {
  let freshTrace: FreshTrace;
  let admin: HardhatEthersSigner;
  let producer: HardhatEthersSigner;
  let logistics: HardhatEthersSigner;
  let retailer: HardhatEthersSigner;
  let auditor: HardhatEthersSigner;

  let PRODUCER_ROLE: string;
  let LOGISTICS_ROLE: string;
  let RETAILER_ROLE: string;
  let AUDITOR_ROLE: string;

  const validDate = () => Math.floor(Date.now() / 1000) - 86400;

  async function register(opts: {
    name?: string;
    origin?: string;
    date?: number;
    qty?: bigint | number;
    unit?: 0 | 1;
    ocop?: boolean;
    ipfs?: string;
    signer?: HardhatEthersSigner;
  } = {}): Promise<string> {
    const tx = await freshTrace
      .connect(opts.signer ?? producer)
      .registerBatch(
        opts.name ?? "Mango",
        opts.origin ?? "Dong Thap",
        opts.date ?? validDate(),
        opts.qty ?? 500_000,
        opts.unit ?? 0,
        opts.ocop ?? true,
        opts.ipfs ?? ""
      );
    const receipt = await tx.wait();
    const ev = receipt!.logs.find((log) => {
      try { return freshTrace.interface.parseLog(log as any)?.name === "BatchRegistered"; }
      catch { return false; }
    });
    return freshTrace.interface.parseLog(ev as any)!.args.batchId;
  }

  beforeEach(async function () {
    [admin, producer, logistics, retailer, auditor] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FreshTrace");
    freshTrace = await Factory.deploy();
    await freshTrace.waitForDeployment();

    PRODUCER_ROLE  = await freshTrace.PRODUCER_ROLE();
    LOGISTICS_ROLE = await freshTrace.LOGISTICS_ROLE();
    RETAILER_ROLE  = await freshTrace.RETAILER_ROLE();
    AUDITOR_ROLE   = await freshTrace.AUDITOR_ROLE();

    await freshTrace.grantRole(PRODUCER_ROLE,  producer.address);
    await freshTrace.grantRole(LOGISTICS_ROLE, logistics.address);
    await freshTrace.grantRole(RETAILER_ROLE,  retailer.address);
    await freshTrace.grantRole(AUDITOR_ROLE,   auditor.address);
  });

  // ── Boundary values ────────────────────────────────────────────────

  describe("Boundary values", function () {
    it("Accepts quantity = 1 (minimum positive)", async function () {
      const id = await register({ qty: 1 });
      const [b] = await freshTrace.getHistory(id);
      expect(b.quantity).to.equal(1n);
    });

    it("Accepts quantity at uint256 max", async function () {
      const MAX = (2n ** 256n) - 1n;
      const id = await register({ qty: MAX });
      const [b] = await freshTrace.getHistory(id);
      expect(b.quantity).to.equal(MAX);
    });

    it("Accepts productName at exactly 300 bytes (boundary)", async function () {
      const name = "a".repeat(300);
      const id = await register({ name });
      const [b] = await freshTrace.getHistory(id);
      expect(b.productName).to.equal(name);
    });

    it("Rejects productName at 301 bytes", async function () {
      const name = "a".repeat(301);
      await expect(register({ name })).to.be.revertedWith("productName too long");
    });

    it("Accepts origin at exactly 300 bytes (boundary)", async function () {
      const origin = "x".repeat(300);
      const id = await register({ origin });
      const [b] = await freshTrace.getHistory(id);
      expect(b.origin).to.equal(origin);
    });

    it("Accepts a long Vietnamese product name within 300-byte budget", async function () {
      // 100 chars of "đ" = 200 bytes — well within 300-byte limit
      const name = "đ".repeat(100);
      const id = await register({ name });
      const [b] = await freshTrace.getHistory(id);
      expect(b.productName).to.equal(name);
    });

    it("Accepts ipfsHash at exactly 100 chars", async function () {
      const ipfs = "Q".repeat(100);
      const id = await register({ ipfs });
      const [b] = await freshTrace.getHistory(id);
      expect(b.ipfsHash).to.equal(ipfs);
    });

    it("Rejects ipfsHash at 101 chars", async function () {
      const ipfs = "Q".repeat(101);
      await expect(register({ ipfs })).to.be.revertedWith("ipfsHash too long");
    });

    it("Accepts harvestDate exactly at upper limit (30 days ahead)", async function () {
      const future = Math.floor(Date.now() / 1000) + 30 * 86400 - 60; // ~30d ahead minus 1 min buffer
      const id = await register({ date: future });
      const [b] = await freshTrace.getHistory(id);
      expect(b.harvestDate).to.equal(future);
    });

    it("Rejects harvestDate at 31 days ahead", async function () {
      const future = Math.floor(Date.now() / 1000) + 31 * 86400;
      await expect(register({ date: future })).to.be.revertedWith("harvestDate too far in future");
    });

    it("Accepts any past harvestDate (no past floor by design)", async function () {
      // Past-date check was removed: contract accepts any past timestamp
      // including legacy migrations from year 2000 or earlier.
      const tenYearsAgo = Math.floor(Date.now() / 1000) - 10 * 365 * 86400;
      const id = await register({ date: tenYearsAgo });
      const [b] = await freshTrace.getHistory(id);
      expect(b.harvestDate).to.equal(tenYearsAgo);
    });

    it("Accepts timestamp = 1 (year 1970) — no past floor", async function () {
      const id = await register({ date: 1 });
      const [b] = await freshTrace.getHistory(id);
      expect(b.harvestDate).to.equal(1);
    });
  });

  // ── UTF-8 and special characters ───────────────────────────────────

  describe("UTF-8 / international input", function () {
    it("Stores Vietnamese diacritics correctly", async function () {
      const name = "Dâu tây Đà Lạt";
      const origin = "Lâm Đồng, Việt Nam";
      const id = await register({ name, origin });
      const [b] = await freshTrace.getHistory(id);
      expect(b.productName).to.equal(name);
      expect(b.origin).to.equal(origin);
    });

    it("Stores emoji in productName", async function () {
      const name = "🍓 Strawberry 🌱";
      const id = await register({ name });
      const [b] = await freshTrace.getHistory(id);
      expect(b.productName).to.equal(name);
    });

    it("Stores Chinese characters", async function () {
      const id = await register({ name: "草莓", origin: "中国" });
      const [b] = await freshTrace.getHistory(id);
      expect(b.productName).to.equal("草莓");
      expect(b.origin).to.equal("中国");
    });

    it("Counts bytes, not characters, for length limits", async function () {
      // "đ" = 2 bytes in UTF-8. 151 chars of "đ" = 302 bytes → exceeds 300-byte limit.
      const overLimit = "đ".repeat(151);
      await expect(register({ name: overLimit })).to.be.revertedWith("productName too long");
    });
  });

  // ── Duplicate detection ────────────────────────────────────────────

  describe("Duplicate detection", function () {
    it("Allows two batches with same name/origin in different blocks", async function () {
      const id1 = await register({ name: "Mango", origin: "Dong Thap" });
      // Advance one second so block.timestamp differs
      await ethers.provider.send("evm_increaseTime", [1]);
      const id2 = await register({ name: "Mango", origin: "Dong Thap" });
      expect(id1).to.not.equal(id2);
    });

    it("encodePacked collision fix: ('ab','cd') vs ('a','bcd') produce different IDs", async function () {
      // Security regression test for the abi.encode switch.
      // Under abi.encodePacked these two would collide because the packed
      // bytes "ab"+"cd" == "a"+"bcd" == "abcd".
      const id1 = await register({ name: "ab", origin: "cd" });
      await ethers.provider.send("evm_increaseTime", [1]);
      const id2 = await register({ name: "a", origin: "bcd" });
      expect(id1).to.not.equal(id2);
    });
  });

  // ── Add-on placement edge cases ────────────────────────────────────

  describe("Add-on placement", function () {
    let batchId: string;
    beforeEach(async function () {
      batchId = await register();
    });

    it("Add-on immediately after HARVESTED is allowed", async function () {
      await freshTrace.connect(logistics).logAddon(batchId, "QC", "Farm Lab", "");
      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(2);
      expect(cps[1].addonLabel).to.equal("QC");
    });

    it("Add-on after RECEIVED (end of chain) is allowed", async function () {
      // Walk through full main flow first
      await freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Hub", "");
      await freshTrace.connect(logistics).logCheckpoint(batchId, 2, "Pack", "");
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Ship", "");
      await freshTrace.connect(retailer).logCheckpoint(batchId, 4, "Store", "");

      await freshTrace.connect(retailer).logAddon(batchId, "Shelf Audit", "Store", "");

      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(6);
      expect(cps[5].addonLabel).to.equal("Shelf Audit");
    });

    it("Main checkpoint AFTER add-on AFTER RECEIVED still reverts (no backward)", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Port", "");
      await freshTrace.connect(retailer).logCheckpoint(batchId, 4, "Store", "");
      await freshTrace.connect(retailer).logAddon(batchId, "Display", "Store", "");

      // RECEIVED is highest stage; any main checkpoint should fail
      await expect(
        freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Back", "")
      ).to.be.revertedWithCustomError(freshTrace, "AnomalyDetected");
    });

    it("5 add-ons in a row do not corrupt main-flow ordering", async function () {
      for (let i = 0; i < 5; i++) {
        await freshTrace.connect(logistics).logAddon(batchId, `Step${i}`, "Loc", "");
      }
      // Should still be able to log a normal PROCESSED
      await freshTrace.connect(logistics).logCheckpoint(batchId, 1, "Factory", "");
      const [, cps] = await freshTrace.getHistory(batchId);
      expect(cps.length).to.equal(7); // HARVESTED + 5 add-ons + PROCESSED
      expect(cps[6].action).to.equal(1);
    });
  });

  // ── Flag lifecycle edge cases ──────────────────────────────────────

  describe("Flag lifecycle stress", function () {
    let batchId: string;
    beforeEach(async function () {
      batchId = await register();
    });

    it("Resolve then re-flag for the same reason creates 2 flags", async function () {
      await freshTrace.connect(auditor).flagBatch(batchId, "Temperature");
      await freshTrace.connect(auditor).resolveFlag(batchId, 0);
      await freshTrace.connect(auditor).flagBatch(batchId, "Temperature");

      const [b, , flags] = await freshTrace.getHistory(batchId);
      expect(flags.length).to.equal(2);
      expect(flags[0].resolved).to.be.true;
      expect(flags[1].resolved).to.be.false;
      expect(b.flagged).to.be.true; // newest one unresolved
    });

    it("Out-of-order resolution: resolve flag 1 before flag 0", async function () {
      await freshTrace.connect(auditor).flagBatch(batchId, "A");
      await freshTrace.connect(auditor).flagBatch(batchId, "B");
      await freshTrace.connect(auditor).resolveFlag(batchId, 1); // resolve second flag first

      const [b, , flags] = await freshTrace.getHistory(batchId);
      expect(flags[0].resolved).to.be.false;
      expect(flags[1].resolved).to.be.true;
      expect(b.flagged).to.be.true; // first flag still open
    });

    it("Resolve all 5 flags clears batch.flagged", async function () {
      for (let i = 0; i < 5; i++) {
        await freshTrace.connect(auditor).flagBatch(batchId, `Issue ${i}`);
      }
      for (let i = 0; i < 5; i++) {
        await freshTrace.connect(auditor).resolveFlag(batchId, i);
      }
      const [b] = await freshTrace.getHistory(batchId);
      expect(b.flagged).to.be.false;
    });

    it("Flagging still allowed after batch reaches RECEIVED", async function () {
      await freshTrace.connect(logistics).logCheckpoint(batchId, 3, "Hub", "");
      await freshTrace.connect(retailer).logCheckpoint(batchId, 4, "Store", "");
      await freshTrace.connect(auditor).flagBatch(batchId, "Retroactive audit");

      const [b] = await freshTrace.getHistory(batchId);
      expect(b.flagged).to.be.true;
    });
  });

  // ── RBAC stress ────────────────────────────────────────────────────

  describe("Role-based access control stress", function () {
    it("Granting same role twice is idempotent", async function () {
      await freshTrace.grantRole(PRODUCER_ROLE, producer.address);
      // Should NOT revert — OpenZeppelin AccessControl handles this
      expect(await freshTrace.hasRole(PRODUCER_ROLE, producer.address)).to.be.true;
    });

    it("Revoked role can no longer call protected function", async function () {
      const id = await register();
      await freshTrace.revokeRole(LOGISTICS_ROLE, logistics.address);
      await expect(
        freshTrace.connect(logistics).logCheckpoint(id, 1, "Hub", "")
      ).to.be.reverted;
    });

    it("Multiple roles on one wallet: same address can have all 4", async function () {
      await freshTrace.grantRole(LOGISTICS_ROLE, producer.address);
      await freshTrace.grantRole(RETAILER_ROLE,  producer.address);
      await freshTrace.grantRole(AUDITOR_ROLE,   producer.address);
      expect(await freshTrace.hasRole(LOGISTICS_ROLE, producer.address)).to.be.true;
      expect(await freshTrace.hasRole(AUDITOR_ROLE,   producer.address)).to.be.true;
    });

    it("Non-admin cannot grant roles", async function () {
      await expect(
        freshTrace.connect(producer).grantRole(LOGISTICS_ROLE, logistics.address)
      ).to.be.reverted;
    });
  });

  // ── Read functions on empty state ──────────────────────────────────

  describe("View functions on edge state", function () {
    it("getBatchIds on fresh deploy returns []", async function () {
      const Factory = await ethers.getContractFactory("FreshTrace");
      const fresh = await Factory.deploy();
      await fresh.waitForDeployment();
      expect((await fresh.getBatchIds()).length).to.equal(0);
    });

    it("getHistory on resolved+reflagged batch returns latest state", async function () {
      const id = await register();
      await freshTrace.connect(auditor).flagBatch(id, "A");
      await freshTrace.connect(auditor).resolveFlag(id, 0);
      await freshTrace.connect(auditor).flagBatch(id, "B");

      const [, , flags] = await freshTrace.getHistory(id);
      expect(flags.length).to.equal(2);
      expect(flags[0].reason).to.equal("A");
      expect(flags[1].reason).to.equal("B");
    });
  });
});
