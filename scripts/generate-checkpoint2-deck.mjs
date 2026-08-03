import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const OUT_DIR = path.join(ROOT, "docs", "presentation");
const PREVIEW_DIR = path.join(OUT_DIR, "preview");
const ASSET_DIR = path.join(ROOT, "assets", "readme");
const PPTX_PATH = path.join(OUT_DIR, "CCN_Checkpoint2_Deck.pptx");
const PDF_PATH = path.join(OUT_DIR, "CCN_Checkpoint2_Deck.pdf");

const W = 1280;
const H = 720;
const C = {
  accent: "#5B5CF6",
  text: "#0B1020",
  secondary: "#667085",
  border: "#E4E7EC",
  soft: "#F8F9FC",
  white: "#FFFFFF",
  dark: "#030817",
  dark2: "#0B1020",
  teal: "#14B8A6",
  green: "#22C55E",
};

const evidence = {
  network: "Arc Testnet",
  chainId: "5042002",
  contract: "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D",
  treasury: "0x6d2ca88a7bDA59280D9ad0E41aA87C9acF24Aa1A",
  paymentWallet: "0xB1E2700290381396BC2A85bb6C286EaD5e80A5dd",
  payoutWallet: "0x37e30Fe02f1f0a7d46ea7CD254398830bE8C30b9",
  fundingTx: "0xb0840e9dcd4509c054e7397641df04d82318838f034e2c8f5355dd1495e5e249",
  fundingChallenge: "0xc71562ffa5142a1e1d071cd8107b59591901cd993787b19397c1d8ceba7d294b",
  payoutTx: "0x2d11480d5929d501736fbc976395b9a213f8a79ed711ea2e9447133a9b38199d",
  payoutChallenge: "0x98a03a73cab4f10049f2269c348b69031aa78484b15c9098943e5cea07bcbdd9",
  payoutBlock: "53726923",
};

function artifactPackage() {
  const candidates = [
    process.env.ARTIFACT_TOOL_ENTRYPOINT,
    path.join(process.env.HOME ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "@oai", "artifact-tool", "dist", "node", "artifact_tool.mjs"),
    path.join(process.env.USERPROFILE ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "@oai", "artifact-tool", "dist", "node", "artifact_tool.mjs"),
    path.join(process.env.USERPROFILE ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "@oai", "artifact-tool", "dist", "artifact_tool.mjs"),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fsSync.existsSync(candidate));
  if (!found) {
    throw new Error("Could not locate @oai/artifact-tool. Set ARTIFACT_TOOL_ENTRYPOINT to the bundled artifact_tool.mjs path.");
  }
  return found;
}

async function readImage(file) {
  const bytes = await fs.readFile(path.join(ASSET_DIR, file));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function runtimeNodeModules() {
  const candidates = [
    path.join(process.env.HOME ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules"),
    path.join(process.env.USERPROFILE ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules"),
  ];
  const found = candidates.find((candidate) => fsSync.existsSync(candidate));
  if (!found) {
    throw new Error("Could not locate bundled node_modules for PDF generation.");
  }
  return found;
}

function loadPngReader() {
  const requireFromRuntime = createRequire(path.join(runtimeNodeModules(), "artifact-tool-runtime.cjs"));
  return requireFromRuntime("pngjs").PNG;
}

function pdfStream(dictionary, body) {
  const header = Buffer.from(`${dictionary} /Length ${body.length} >>\nstream\n`, "binary");
  const footer = Buffer.from("\nendstream", "binary");
  return Buffer.concat([header, body, footer]);
}

async function writePdfFromPngPreviews(slidePaths) {
  const PNG = loadPngReader();
  const objects = [null, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "binary"), null];
  const kids = [];

  for (const [index, slidePath] of slidePaths.entries()) {
    const png = PNG.sync.read(await fs.readFile(slidePath));
    const rgb = Buffer.alloc(png.width * png.height * 3);
    for (let source = 0, target = 0; source < png.data.length; source += 4, target += 3) {
      rgb[target] = png.data[source];
      rgb[target + 1] = png.data[source + 1];
      rgb[target + 2] = png.data[source + 2];
    }

    const imageObject = objects.length;
    objects.push(pdfStream(`<< /Type /XObject /Subtype /Image /Width ${png.width} /Height ${png.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, deflateSync(rgb)));

    const content = Buffer.from(`q\n${W} 0 0 ${H} 0 0 cm\n/Im${index + 1} Do\nQ`, "binary");
    const contentObject = objects.length;
    objects.push(pdfStream("<<", content));

    const pageObject = objects.length;
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${index + 1} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`, "binary"));
    kids.push(`${pageObject} 0 R`);
  }

  objects[2] = Buffer.from(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`, "binary");

  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.concat(chunks).length;
    chunks.push(Buffer.from(`${index} 0 obj\n`, "binary"), objects[index], Buffer.from("\nendobj\n", "binary"));
  }
  const xrefOffset = Buffer.concat(chunks).length;
  chunks.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n`, "binary"));
  for (let index = 1; index < objects.length; index += 1) {
    chunks.push(Buffer.from(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`, "binary"));
  }
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "binary"));
  await fs.writeFile(PDF_PATH, Buffer.concat(chunks));
}

function addShape(slide, position, fill = C.white, line = C.border, radius = "rounded-xl") {
  return slide.shapes.add({
    geometry: "roundRect",
    position,
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function addText(slide, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: 20,
    color: C.text,
    typeface: "Inter",
    ...style,
  };
  return shape;
}

function addTitle(slide, title, subtitle) {
  addText(slide, title, { left: 72, top: 56, width: 860, height: 70 }, {
    fontSize: 42,
    bold: true,
    color: C.text,
  });
  if (subtitle) {
    addText(slide, subtitle, { left: 74, top: 124, width: 850, height: 44 }, {
      fontSize: 19,
      color: C.secondary,
    });
  }
}

function addFooter(slide, index, dark = false, label = "CCN - Creator Challenge Network") {
  addText(slide, label, { left: 72, top: 670, width: 440, height: 24 }, {
    fontSize: 16,
    color: dark ? "#B8C0D9" : "#98A2B3",
  });
  addText(slide, String(index).padStart(2, "0"), { left: 1150, top: 670, width: 58, height: 24 }, {
    fontSize: 16,
    bold: true,
    alignment: "right",
    color: dark ? "#B8C0D9" : "#98A2B3",
  });
}

function addBulletCard(slide, title, bullets, position, options = {}) {
  addShape(slide, position, options.fill ?? C.white, options.line ?? C.border, "rounded-xl");
  addText(slide, title, { left: position.left + 28, top: position.top + 24, width: position.width - 56, height: 34 }, {
    fontSize: 24,
    bold: true,
    color: options.titleColor ?? C.text,
  });
  addText(slide, bullets.map((item) => `- ${item}`).join("\n"), {
    left: position.left + 30,
    top: position.top + 78,
    width: position.width - 60,
    height: position.height - 100,
  }, {
    fontSize: 20,
    color: options.bodyColor ?? C.secondary,
    breakLine: false,
  });
}

function addPill(slide, text, x, y, width, fill = C.soft, color = C.text) {
  addShape(slide, { left: x, top: y, width, height: 34 }, fill, fill, "rounded-full");
  addText(slide, text, { left: x + 12, top: y + 7, width: width - 24, height: 18 }, {
    fontSize: 16,
    bold: true,
    color,
    alignment: "center",
  });
}

function shortHash(value) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function addSpeakerNotes(slide, lines) {
  slide.speakerNotes.textFrame.setText(lines);
  slide.speakerNotes.setVisible(true);
}

async function main() {
  const { Presentation, PresentationFile } = await import(pathToFileURL(artifactPackage()).href);
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.rm(PREVIEW_DIR, { recursive: true, force: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });

  const assets = {
    logo: await readImage("logo.png"),
    og: await readImage("og-cover.png"),
    dashboard: await readImage("hero-dashboard.png"),
    architecture: await readImage("architecture.png"),
    workflow: await readImage("workflow.svg"),
  };

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  // 1 Cover
  {
    const s = presentation.slides.add();
    s.background.fill = C.dark;
    s.images.add({ blob: assets.og, contentType: "image/png", alt: "CCN product overview cover", fit: "cover", position: { left: 0, top: 0, width: W, height: H } });
    addShape(s, { left: 890, top: 38, width: 320, height: 34 }, "rgba(3,8,23,0.70)", "rgba(255,255,255,0.18)", "rounded-full");
    addText(s, "Build on Arc Hackathon | Checkpoint 2", { left: 910, top: 46, width: 280, height: 18 }, { fontSize: 16, bold: true, color: "#FFFFFF" });
    addSpeakerNotes(s, ["Locked headline: Discover the World's Best Ideas.", "Locked subheading: Connecting brands with the world's most creative minds through transparent creator campaigns."]);
  }

  // 2 Problem
  {
    const s = presentation.slides.add();
    s.background.fill = C.white;
    addTitle(s, "Creative Ideas Are Still Limited by Closed Networks");
    addBulletCard(s, "BRANDS", [
      "Limited by internal and agency capacity",
      "Fragmented campaign management",
      "Difficult access to global creative talent",
      "Manual funding and payout coordination",
    ], { left: 88, top: 168, width: 520, height: 330 });
    addBulletCard(s, "CREATORS", [
      "Opaque evaluation",
      "Uncertain prize funding",
      "Manual or delayed payouts",
      "Outcomes that cannot be independently verified",
    ], { left: 672, top: 168, width: 520, height: 330 });
    addShape(s, { left: 198, top: 548, width: 884, height: 64 }, C.soft, C.border, "rounded-xl");
    addText(s, "Great ideas are everywhere. Trusted creator campaigns are not.", { left: 238, top: 568, width: 804, height: 26 }, { fontSize: 24, bold: true, alignment: "center" });
    addFooter(s, 2);
  }

  // 3 Opportunity
  {
    const s = presentation.slides.add();
    s.background.fill = C.white;
    addTitle(s, "From Agency-Limited Creativity to Global Participation");
    const left = { x: 98, y: 170, w: 450 };
    const right = { x: 732, y: 170, w: 450 };
    addText(s, "Traditional Model", { left: left.x, top: 144, width: left.w, height: 34 }, { fontSize: 24, bold: true, color: C.secondary, alignment: "center" });
    addText(s, "CCN Model", { left: right.x, top: 144, width: right.w, height: 34 }, { fontSize: 24, bold: true, color: C.accent, alignment: "center" });
    ["Brand", "Internal Team or Agency", "Limited Creative Network", "One Campaign Outcome"].forEach((label, i) => {
      const y = left.y + i * 92;
      addShape(s, { left: left.x, top: y, width: left.w, height: 58 }, i === 0 ? "#FFFFFF" : C.soft, C.border);
      addText(s, label, { left: left.x + 20, top: y + 17, width: left.w - 40, height: 22 }, { fontSize: 20, bold: i === 0, color: i === 0 ? C.text : C.secondary, alignment: "center" });
      if (i < 3) addText(s, "v", { left: left.x + 200, top: y + 59, width: 50, height: 28 }, { fontSize: 24, bold: true, color: C.secondary, alignment: "center" });
    });
    ["Brand", "Global Creator Network", "Blind Evaluation", "Best Idea Wins"].forEach((label, i) => {
      const y = right.y + i * 92;
      addShape(s, { left: right.x, top: y, width: right.w, height: 58 }, i === 3 ? C.accent : "#FFFFFF", i === 3 ? C.accent : "#D7D9FF");
      addText(s, label, { left: right.x + 20, top: y + 17, width: right.w - 40, height: 22 }, { fontSize: 20, bold: true, color: i === 3 ? C.white : C.text, alignment: "center" });
      if (i < 3) addText(s, "v", { left: right.x + 200, top: y + 59, width: 50, height: 28 }, { fontSize: 24, bold: true, color: C.accent, alignment: "center" });
    });
    addFooter(s, 3);
  }

  // 4 Workflow
  {
    const s = presentation.slides.add();
    s.background.fill = C.white;
    addTitle(s, "One Transparent Campaign Lifecycle");
    s.images.add({ blob: assets.workflow, contentType: "image/svg+xml", alt: "CCN campaign workflow", fit: "contain", position: { left: 432, top: 118, width: 416, height: 500 } });
    addText(s, "Campaign creation, funding, participation, evaluation, settlement and verification operate as one connected workflow.", { left: 876, top: 246, width: 260, height: 130 }, { fontSize: 22, color: C.secondary, alignment: "center" });
    addFooter(s, 4);
  }

  // 5 Product
  {
    const s = presentation.slides.add();
    s.background.fill = C.dark;
    addText(s, "The Brand Workspace", { left: 72, top: 52, width: 720, height: 60 }, { fontSize: 42, bold: true, color: C.white });
    s.images.add({ blob: assets.dashboard, contentType: "image/png", alt: "CCN Brand Workspace dashboard", fit: "contain", position: { left: 76, top: 128, width: 1128, height: 480 }, geometry: "roundRect", borderRadius: "rounded-xl" });
    const pills = ["Campaign management", "Prize-pool funding", "Review and winner status", "Wallet and settlement operations"];
    pills.forEach((p, i) => addPill(s, p, 102 + i * 270, 626, i === 3 ? 250 : 230, "rgba(255,255,255,0.10)", "#FFFFFF"));
    addFooter(s, 5, true);
  }

  // 6 Principles
  {
    const s = presentation.slides.add();
    s.background.fill = C.white;
    addTitle(s, "Trust Is Built Into the Workflow");
    const cards = [
      ["Global Participation", "Creative access beyond geography and closed networks."],
      ["Transparent Funding", "Prize pools are committed before creators invest time."],
      ["Blind Review", "Work is evaluated without exposing creator identity."],
      ["Programmable Settlement", "Rewards follow predefined campaign rules."],
      ["Independent Verification", "Funding and payout outcomes can be validated on-chain."],
    ];
    cards.forEach(([title, body], i) => {
      const x = 80 + (i % 3) * 386;
      const y = i < 3 ? 178 : 398;
      const w = i < 3 ? 334 : 520;
      const x2 = i < 3 ? x : 180 + (i - 3) * 560;
      addShape(s, { left: x2, top: y, width: w, height: 150 }, C.soft, C.border);
      addShape(s, { left: x2 + 24, top: y + 24, width: 34, height: 34 }, "#ECECFF", "#ECECFF", "rounded-full");
      addText(s, String(i + 1), { left: x2 + 24, top: y + 32, width: 34, height: 18 }, { fontSize: 16, bold: true, color: C.accent, alignment: "center" });
      addText(s, title, { left: x2 + 72, top: y + 22, width: w - 96, height: 28 }, { fontSize: 22, bold: true });
      addText(s, body, { left: x2 + 24, top: y + 74, width: w - 48, height: 48 }, { fontSize: 18, color: C.secondary });
    });
    addFooter(s, 6);
  }

  // 7 Architecture
  {
    const s = presentation.slides.add();
    s.background.fill = C.white;
    addTitle(s, "Technical Architecture");
    s.images.add({ blob: assets.architecture, contentType: "image/png", alt: "CCN technical architecture", fit: "contain", position: { left: 120, top: 132, width: 1040, height: 432 }, geometry: "roundRect", borderRadius: "rounded-xl" });
    addText(s, "The product experience remains separate from financial settlement while both operate through one coordinated workflow.", { left: 150, top: 594, width: 980, height: 42 }, { fontSize: 21, color: C.secondary, alignment: "center" });
    addFooter(s, 7);
  }

  // 8 Arc + Circle
  {
    const s = presentation.slides.add();
    s.background.fill = C.white;
    addTitle(s, "Arc Powers Settlement. Circle Powers Approval.");
    addBulletCard(s, "ARC", [
      "Programmable escrow",
      "USDC-oriented settlement",
      "Fast transaction execution",
      "On-chain event verification",
      "Blockchain-first reconciliation",
    ], { left: 98, top: 160, width: 500, height: 350 }, { titleColor: C.accent });
    addBulletCard(s, "CIRCLE", [
      "User-Controlled Hosted Wallets",
      "PAYMENT approval",
      "PAYOUT approval",
      "Policy-controlled authorization",
      "Wallet operations integrated into the product",
    ], { left: 682, top: 160, width: 500, height: 350 }, { titleColor: C.teal });
    addShape(s, { left: 180, top: 560, width: 920, height: 56 }, C.soft, C.border, "rounded-xl");
    addText(s, "CCN connects both layers into a transparent creator campaign experience.", { left: 210, top: 576, width: 860, height: 24 }, { fontSize: 22, bold: true, alignment: "center" });
    addFooter(s, 8);
  }

  // 9 Evidence
  {
    const s = presentation.slides.add();
    s.background.fill = C.white;
    addTitle(s, "Verified on Arc Testnet");
    const items = [
      ["Network", evidence.network],
      ["Chain ID", evidence.chainId],
      ["Runtime contract", shortHash(evidence.contract)],
      ["Runtime treasury", shortHash(evidence.treasury)],
      ["PAYMENT wallet", shortHash(evidence.paymentWallet)],
      ["PAYOUT wallet", shortHash(evidence.payoutWallet)],
      ["Funding tx", shortHash(evidence.fundingTx)],
      ["Funding challenge", shortHash(evidence.fundingChallenge)],
      ["Payout tx", shortHash(evidence.payoutTx)],
      ["Payout challenge", shortHash(evidence.payoutChallenge)],
      ["Payout block", evidence.payoutBlock],
      ["Events", "ChallengeFunded | WinnersPaid"],
    ];
    items.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 72 + col * 392;
      const y = 150 + row * 92;
      addShape(s, { left: x, top: y, width: 344, height: 70 }, C.soft, C.border, "rounded-lg");
      addText(s, label, { left: x + 18, top: y + 12, width: 300, height: 18 }, { fontSize: 16, bold: true, color: C.secondary });
      addText(s, value, { left: x + 18, top: y + 36, width: 308, height: 20 }, { fontSize: 18, bold: true, color: C.text });
    });
    const funding = addText(s, "Funding explorer link", { left: 106, top: 548, width: 250, height: 22 }, { fontSize: 18, bold: true, color: C.accent });
    funding.text.get("Funding explorer link").link = { uri: `https://testnet.arcscan.app/tx/${evidence.fundingTx}`, isExternal: true };
    const payout = addText(s, "Payout explorer link", { left: 394, top: 548, width: 230, height: 22 }, { fontSize: 18, bold: true, color: C.accent });
    payout.text.get("Payout explorer link").link = { uri: `https://testnet.arcscan.app/tx/${evidence.payoutTx}`, isExternal: true };
    addText(s, "Funding evidence was additionally verified directly through the Arc Testnet RPC.", { left: 104, top: 588, width: 920, height: 24 }, { fontSize: 18, color: C.secondary });
    addSpeakerNotes(s, [
      `Runtime contract: ${evidence.contract}`,
      `Runtime treasury: ${evidence.treasury}`,
      `PAYMENT wallet: ${evidence.paymentWallet}`,
      `PAYOUT wallet: ${evidence.payoutWallet}`,
      `Funding transaction: ${evidence.fundingTx}`,
      `Funding challenge ID: ${evidence.fundingChallenge}`,
      `Payout transaction: ${evidence.payoutTx}`,
      `Payout challenge ID: ${evidence.payoutChallenge}`,
      "Funding receipt status: success. Payout receipt status: success.",
      "Verified events: ChallengeFunded, WinnersPaid, PAYOUT_CONFIRMED.",
    ]);
    addFooter(s, 9);
  }

  // 10 Status
  {
    const s = presentation.slides.add();
    s.background.fill = C.white;
    addTitle(s, "Checkpoint 2 - What We Built");
    const rows = [
      ["Campaign creation", "Validated"],
      ["Prize-pool configuration", "Validated"],
      ["Escrow funding", "On-chain verified"],
      ["Creator submission flow", "Validated"],
      ["Blind review", "Validated"],
      ["Winner finalization", "Validated"],
      ["Hosted PAYMENT approval", "On-chain verified"],
      ["Hosted PAYOUT approval", "Executed"],
      ["releasePayout()", "On-chain verified"],
      ["WinnersPaid", "On-chain verified"],
      ["Blockchain reconciliation", "Verified"],
      ["PAYOUT_CONFIRMED", "Verified"],
    ];
    rows.forEach(([capability, status], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 86 + col * 560;
      const y = 146 + row * 72;
      addShape(s, { left: x, top: y, width: 508, height: 52 }, C.soft, C.border, "rounded-lg");
      addText(s, capability, { left: x + 20, top: y + 16, width: 280, height: 20 }, { fontSize: 18, bold: true });
      const pillColor = status === "On-chain verified" ? "#DCFCE7" : status === "Executed" ? "#E0F2FE" : "#ECECFF";
      const textColor = status === "On-chain verified" ? "#166534" : status === "Executed" ? "#075985" : C.accent;
      addPill(s, status, x + 314, y + 11, 170, pillColor, textColor);
    });
    addFooter(s, 10);
  }

  // 11 Vision
  {
    const s = presentation.slides.add();
    s.background.fill = C.dark;
    s.images.add({ blob: assets.logo, contentType: "image/png", alt: "Official CCN logo", fit: "contain", position: { left: 82, top: 80, width: 320, height: 110 } });
    addText(s, "Discover the World's Best Ideas.", { left: 82, top: 250, width: 880, height: 78 }, { fontSize: 54, bold: true, color: C.white });
    addText(s, "CCN enables brands to move beyond agency-limited creativity by connecting them with a global network of creators through transparent campaign workflows.", { left: 86, top: 354, width: 840, height: 96 }, { fontSize: 25, color: "#D4DAEA" });
    addText(s, "Creator Challenge Network\nBuilt on Arc with Circle and USDC", { left: 86, top: 590, width: 520, height: 54 }, { fontSize: 20, color: "#B8C0D9" });
    addFooter(s, 11, true, "");
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(PREVIEW_DIR, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(PREVIEW_DIR, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(path.join(PREVIEW_DIR, "montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  await writePdfFromPngPreviews((await fs.readdir(PREVIEW_DIR)).filter((file) => /^slide-\d+\.png$/.test(file)).sort().map((file) => path.join(PREVIEW_DIR, file)));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(PPTX_PATH);
  await fs.rm(path.join(OUT_DIR, "CCN_Checkpoint2_Deck.pptx.inspect.ndjson"), { force: true });
  await fs.rm(path.join(OUT_DIR, "CCN_Checkpoint2_Deck.inspect.ndjson"), { force: true });
  process.exitCode = 0;
  console.log(JSON.stringify({
    pptx: PPTX_PATH,
    pdf: PDF_PATH,
    previewDir: PREVIEW_DIR,
    slideCount: presentation.slides.items.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
