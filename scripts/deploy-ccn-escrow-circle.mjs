import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initiateSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const bootstrapRoot = path.resolve(repoRoot, "..", "ccn-circle-bootstrap");

const BLOCKCHAIN = "ARC-TESTNET";
const ARC_TESTNET_CHAIN_ID = 5042002;
const ARC_TESTNET_EXPLORER_URL = "https://testnet.arcscan.app";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const DEPLOYMENT_NAME = "CCNEscrowHackathonTestnet";
const DEPLOYMENT_DESCRIPTION =
  "Programmable USDC escrow for funded creative competitions on Arc Testnet.";
const LOCAL_DIR = path.join(repoRoot, ".local");
const DEPLOY_STATE_PATH = path.join(LOCAL_DIR, "circle-ccn-escrow-deploy.json");
const ARTIFACT_PATH = path.join(
  repoRoot,
  "contracts",
  "out",
  "CCNEscrow.sol",
  "CCNEscrow.json",
);

function readEnvFile(filePath) {
  const env = {};
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function mask(value, prefix = 6, suffix = 4) {
  if (!value || value.length <= prefix + suffix) return "Not available";
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

function ensureAddress(value, label) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value ?? "")) {
    throw new Error(`${label} is not a valid EVM address.`);
  }
}

function loadDeploymentState() {
  if (!existsSync(DEPLOY_STATE_PATH)) {
    return {
      idempotencyKey: randomUUID(),
      createdAt: new Date().toISOString(),
      blockchain: BLOCKCHAIN,
      chainId: ARC_TESTNET_CHAIN_ID,
      status: "PREPARED",
    };
  }

  return JSON.parse(readFileSync(DEPLOY_STATE_PATH, "utf8"));
}

function saveDeploymentState(state) {
  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(DEPLOY_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function extractPayloadData(response) {
  const payload = response?.data ?? response;
  return payload?.data ?? payload;
}

function redactCircleError(error) {
  const response = error?.response;
  const data = response?.data;

  return {
    endpoint:
      error?.url && error?.method
        ? `${error.method} ${error.url}`
        : "POST /v1/w3s/contracts/deploy or GET /v1/w3s/contracts/{id}",
    httpStatus: error?.status ?? response?.status ?? "Not available",
    circleErrorCode:
      error?.code ??
      data?.code ??
      data?.errorCode ??
      data?.errors?.[0]?.code ??
      "Not available",
    redactedError:
      error?.message ??
      data?.message ??
      data?.error ??
      data?.errors?.[0]?.message ??
      "Unknown Circle error",
  };
}

function isTerminal(contract) {
  const status = contract?.status ?? "UNKNOWN";
  return status === "COMPLETE" || status === "FAILED";
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollContract(client, contractId) {
  let lastContract;

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const response = await client.getContract({ id: contractId });
    const payload = extractPayloadData(response);
    lastContract = payload?.contract ?? payload;

    const status = lastContract?.status ?? "UNKNOWN";
    console.log(`poll=${attempt} status=${status}`);

    if (isTerminal(lastContract)) {
      return lastContract;
    }

    await sleep(10000);
  }

  return lastContract;
}

async function main() {
  if (process.env.CONFIRM_ARC_TESTNET_DEPLOY !== "true") {
    throw new Error("Set CONFIRM_ARC_TESTNET_DEPLOY=true to deploy.");
  }

  if (BLOCKCHAIN !== "ARC-TESTNET" || ARC_TESTNET_CHAIN_ID !== 5042002) {
    throw new Error("Deployment target must remain ARC-TESTNET / chain ID 5042002.");
  }

  const bootstrapEnv = readEnvFile(path.join(bootstrapRoot, ".env.local"));
  const bootstrapState = JSON.parse(
    readFileSync(path.join(bootstrapRoot, ".local-state.json"), "utf8"),
  );

  const apiKey = bootstrapEnv.CIRCLE_API_KEY;
  const entitySecret = bootstrapEnv.CIRCLE_ENTITY_SECRET;
  const walletId = bootstrapState.walletId;
  const deployerAddress = bootstrapState.walletAddress;

  if (!apiKey || !entitySecret) {
    throw new Error("Circle API key and entity secret must exist in bootstrap .env.local.");
  }

  if (bootstrapState.blockchain !== BLOCKCHAIN) {
    throw new Error("Bootstrap wallet mapping is not ARC-TESTNET.");
  }

  ensureAddress(deployerAddress, "Deployer wallet address");
  ensureAddress(ARC_TESTNET_USDC, "Arc Testnet USDC");

  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode?.object
    ? `0x${artifact.bytecode.object.replace(/^0x/, "")}`
    : artifact.bytecode;

  if (!Array.isArray(abi) || abi.length === 0) {
    throw new Error("CCNEscrow ABI is missing or empty.");
  }

  if (!bytecode || bytecode === "0x") {
    throw new Error("CCNEscrow bytecode is missing or empty.");
  }

  const constructorParameters = [
    ARC_TESTNET_USDC,
    deployerAddress,
    deployerAddress,
    deployerAddress,
    deployerAddress,
  ];

  const deploymentState = loadDeploymentState();
  if (deploymentState.blockchain && deploymentState.blockchain !== BLOCKCHAIN) {
    throw new Error("Stored deployment state is not for ARC-TESTNET.");
  }

  if (!deploymentState.finalCorrectedSdkAttemptPreparedAt) {
    deploymentState.idempotencyKey = randomUUID();
    deploymentState.finalCorrectedSdkAttemptPreparedAt = new Date().toISOString();
    deploymentState.status = "PREPARED_FINAL_CORRECTED_SDK";
  }

  if (deploymentState.contractAddress) {
    console.log(
      JSON.stringify(
        {
          result: "already_deployed",
          contractId: deploymentState.contractId,
          transactionId: deploymentState.transactionId,
          status: deploymentState.status,
          contractAddress: deploymentState.contractAddress,
          transactionHash: deploymentState.transactionHash,
          deployerWalletId: mask(walletId),
          deployerAddress: mask(deployerAddress),
          contractUrl: `${ARC_TESTNET_EXPLORER_URL}/address/${deploymentState.contractAddress}`,
          transactionUrl: deploymentState.transactionHash
            ? `${ARC_TESTNET_EXPLORER_URL}/tx/${deploymentState.transactionHash}`
            : null,
        },
        null,
        2,
      ),
    );
    return;
  }

  deploymentState.blockchain = BLOCKCHAIN;
  deploymentState.chainId = ARC_TESTNET_CHAIN_ID;
  deploymentState.deployerWalletIdMasked = mask(walletId);
  deploymentState.deployerAddressMasked = mask(deployerAddress);
  deploymentState.usdc = ARC_TESTNET_USDC;
  deploymentState.constructorParameterLabels = [
    "usdc_",
    "treasury_",
    "admin_",
    "resolver_",
    "pauser_",
  ];
  deploymentState.requestKeyNames = [
    "idempotencyKey",
    "name",
    "description",
    "blockchain",
    "walletId",
    "abiJson",
    "bytecode",
    "constructorParameters",
    "fee",
  ];
  delete deploymentState.constructorSignature;
  saveDeploymentState(deploymentState);

  const client = initiateSmartContractPlatformClient({
    apiKey,
    entitySecret,
  });

  if (process.env.CCN_DEPLOY_PREFLIGHT_ONLY === "true") {
    console.log(
      JSON.stringify(
        {
          sdkMethod: "client.deployContract",
          requestKeyNames: deploymentState.requestKeyNames,
          name: DEPLOYMENT_NAME,
          blockchain: BLOCKCHAIN,
          deployerWalletId: mask(walletId),
          constructorParameterTypes: [
            "address usdc_",
            "address treasury_",
            "address admin_",
            "address resolver_",
            "address pauser_",
          ],
          bytecodeBytes: (bytecode.length - 2) / 2,
          entitySecretConfigured: Boolean(entitySecret),
          validationsPassed: true,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (deploymentState.finalCorrectedSdkAttemptSubmittedAt) {
    throw new Error("Final corrected SDK deployment attempt was already submitted.");
  }

  try {
    console.log(
      JSON.stringify(
        {
          action: "deployContract",
          blockchain: BLOCKCHAIN,
          chainId: ARC_TESTNET_CHAIN_ID,
          deployerWalletId: mask(walletId),
          deployerAddress: mask(deployerAddress),
          bytecodeBytes: (bytecode.length - 2) / 2,
          abiEntries: abi.length,
          requestKeyNames: deploymentState.requestKeyNames,
        },
        null,
        2,
      ),
    );

    deploymentState.finalCorrectedSdkAttemptSubmittedAt = new Date().toISOString();
    saveDeploymentState(deploymentState);

    const deployResponse = await client.deployContract({
      idempotencyKey: deploymentState.idempotencyKey,
      name: DEPLOYMENT_NAME,
      description: DEPLOYMENT_DESCRIPTION,
      blockchain: BLOCKCHAIN,
      walletId,
      abiJson: JSON.stringify(abi),
      bytecode,
      constructorParameters,
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const deployPayload = extractPayloadData(deployResponse);
    deploymentState.contractId = deployPayload?.contractId;
    deploymentState.transactionId = deployPayload?.transactionId;
    deploymentState.deploySubmittedAt = new Date().toISOString();
    deploymentState.status = "SUBMITTED";
    saveDeploymentState(deploymentState);

    const contract = await pollContract(client, deploymentState.contractId);

    deploymentState.status = contract?.status ?? deploymentState.status;
    deploymentState.contractAddress = contract?.contractAddress;
    deploymentState.transactionHash = contract?.txHash;
    deploymentState.deploymentTransactionId =
      contract?.deploymentTransactionId ?? deploymentState.transactionId;
    deploymentState.deployerAddress = contract?.deployerAddress
      ? mask(contract.deployerAddress)
      : deploymentState.deployerAddressMasked;
    deploymentState.completedAt =
      contract?.status === "COMPLETE" ? new Date().toISOString() : undefined;
    deploymentState.errorReason = contract?.deploymentErrorReason;
    deploymentState.errorDetails = contract?.deploymentErrorDetails;
    saveDeploymentState(deploymentState);

    console.log(
      JSON.stringify(
        {
          result: contract?.status === "COMPLETE" ? "deployed" : "not_complete",
          contractId: deploymentState.contractId,
          transactionId: deploymentState.transactionId,
          status: deploymentState.status,
          contractAddress: deploymentState.contractAddress ?? null,
          transactionHash: deploymentState.transactionHash ?? null,
          contractUrl: deploymentState.contractAddress
            ? `${ARC_TESTNET_EXPLORER_URL}/address/${deploymentState.contractAddress}`
            : null,
          transactionUrl: deploymentState.transactionHash
            ? `${ARC_TESTNET_EXPLORER_URL}/tx/${deploymentState.transactionHash}`
            : null,
          errorReason: deploymentState.errorReason ?? null,
          errorDetails: deploymentState.errorDetails ?? null,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    deploymentState.status = "ERROR";
    deploymentState.lastError = redactCircleError(error);
    deploymentState.updatedAt = new Date().toISOString();
    saveDeploymentState(deploymentState);

    console.error(JSON.stringify(deploymentState.lastError, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error?.message ?? "Unknown deployment script error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
