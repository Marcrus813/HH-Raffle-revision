const fs = require("fs");
const path = require("path");

function exportArtifact(chainId) {
    console.log(`Exporting artifact for chainId: [${chainId}]`);
    const addressSourceDir = path.join(
        __dirname,
        `../ignition/deployments/chain-${chainId}/deployed_addresses.json`,
    );
    const abiSourceDir = path.join(
        __dirname,
        `../ignition/deployments/chain-${chainId}/artifacts/RaffleModule#Raffle.json`,
    );
    const targetDir = path.join(__dirname, `../../NextJs-Raffle/artifacts/`);

    try {
        if (!fs.existsSync(targetDir)) {
            // Create the dir if non-exist
            fs.mkdirSync(targetDir);
        }

        if (fs.existsSync(addressSourceDir)) {
            fs.copyFileSync(addressSourceDir, path.join(targetDir, `deployed_addresses.json`));
            console.log(`Copied address info to ${targetDir}`);
        } else {
            console.log(`File not found: ${addressSourceDir}`);
        }

        if (fs.existsSync(abiSourceDir)) {
            fs.copyFileSync(abiSourceDir, path.join(targetDir, `Raffle.json`));
            console.log(`Copied ABI to ${targetDir}`);
        } else {
            console.log(`File not found: ${abiSourceDir}`);
        }
    } catch (error) {
        console.log(`Error: ${error}`);
    }
}

async function main() {
    exportArtifact(31337);
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = exportArtifact;
