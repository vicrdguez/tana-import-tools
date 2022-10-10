import { appendFileSync, unlinkSync } from 'fs';
import path from 'path';
import { createUnlinkedTanaNodes } from './createUnlinkedTanaNodes';
import { HeadingTracker } from './filterHeadingLinks';
import { postProcessTIFFIle } from './postProcessTIFFile';
import { addFileNode, addParentNodeEnd, addParentNodeStart, handleVault } from './vault';
import { VaultContext } from './VaultContext';

/**
 * Converts the vault to the Tana format and incrementally saves it, otherwise it would be to memory intensive on big vaults.
 * Due to the incremental approach the output-file will be valid JSON but not be formatted perfectly.
 */
export async function ObsidianVaultConverter(
  vaultPath: string,
  today: number = Date.now(),
  vaultContext: VaultContext = new VaultContext(),
) {
  if (vaultPath.endsWith('/')) {
    vaultPath = vaultPath.slice(0, -1);
  }

  const targetPath = `${vaultPath}.tif.json`;
  try {
    unlinkSync(targetPath);
    // eslint-disable-next-line no-empty
  } catch (e) {}
  appendFileSync(targetPath, '{\n  "version": "TanaIntermediateFile V0.1",\n  "nodes": [\n');

  const headingTracker: HeadingTracker = new Map();

  handleVault(
    vaultPath,
    addParentNodeStart(targetPath, today, vaultContext),
    addParentNodeEnd(targetPath),
    addFileNode(targetPath, today, vaultContext, headingTracker),
  );

  //the vault-node needs to be counted as a top level node
  vaultContext.summary.leafNodes--;
  vaultContext.summary.topLevelNodes++;

  //post processing can be done before unlinked (it will add unlinked headings)
  //because the unlinked summary nodes are just created by the converter and have no connection to the rest
  await postProcessTIFFIle(targetPath, vaultContext, headingTracker);

  const collectedUnlinkedNodes = createUnlinkedTanaNodes(path.basename(vaultPath), today, vaultContext);
  if (collectedUnlinkedNodes) {
    appendFileSync(targetPath, ', ' + JSON.stringify(collectedUnlinkedNodes, null, 2));
  }

  //close vault-node children
  appendFileSync(targetPath, '\n  ]');

  const superTags = vaultContext.createSuperTagObjects();
  if (superTags.length > 0) {
    appendFileSync(targetPath, ',\n  "supertags": \n' + JSON.stringify(superTags, null, 2));
  }

  appendFileSync(targetPath, ',\n  "summary": \n' + JSON.stringify(vaultContext.summary, null, 2));

  //close target object
  appendFileSync(targetPath, '\n}');

  return vaultContext.summary;
}
