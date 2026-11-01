// Post-build gate for datums. Fails on a duplicate id, an unknown kind or a relation that does not
// resolve. Prints every `violates` link, which stays visible until someone resolves it.
// `node scripts/check-datums.mjs --next` prints the next free id and does nothing else.
import { scanDatums, datumProblems, nextDatumId } from "../src/lib/datums.mjs";

const datums = scanDatums();
if (process.argv.includes("--next")) {
   console.log(nextDatumId(datums));
   process.exit(0);
}

const problems = datumProblems(datums);
if (problems.length) {
   console.error("Datum check failed:\n - " + problems.join("\n - "));
   process.exit(1);
}

const violations = datums.flatMap((d) =>
   d.relations
      .filter((r) => r.type === "violates")
      .map((r) => `${d.id} violates ${r.target}`),
);
if (violations.length)
   console.log(
      `Open violations (${violations.length}):\n - ${violations.join("\n - ")}`,
   );
console.log(
   `Datum check ok: ${datums.length} datums, ${datums.filter((d) => d.published).length} published.`,
);
