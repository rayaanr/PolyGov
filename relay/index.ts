import { runProposalIdSync } from "./proposalSync";
import { startMainWatcher } from "./mainWatcher";
import { startSecondaryWatchers } from "./secondaryWatcher";
import { startSecondaryFinalizer } from "./secondaryFinalizer";
import { startFinalizer } from "./finalizer";

(async () => {
    await runProposalIdSync();
    startMainWatcher();
    startSecondaryWatchers();
    startSecondaryFinalizer();
    startFinalizer();
})();
