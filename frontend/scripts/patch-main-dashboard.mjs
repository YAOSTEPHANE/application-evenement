import fs from "fs";

const path = "src/components/MainContent.tsx";
let c = fs.readFileSync(path, "utf8");

if (!c.includes("DashboardModulePage")) {
  c = c.replace(
    'import { AnalyticsRapports } from "@/components/AnalyticsRapports";',
    `import { AnalyticsRapports } from "@/components/AnalyticsRapports";
import { DashboardModulePage } from "@/components/DashboardModulePage";
import { CdcModulePages, type CdcPageId } from "@/components/CdcModulePages";
import { isCdcModulePage } from "@/lib/cdc-modules";`,
  );
}

const start = c.indexOf('<div id="page-dashboard"');
const end = c.indexOf('<div id="page-catalogue"');
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const block = `<div id="page-dashboard" className={pageClass(activePage, "dashboard")}>
        {activePage === "dashboard" ? (
          <DashboardModulePage
            state={state}
            onNavigate={onNavigate}
            onOpenArticleModal={onOpenArticleModal}
            onOpenEventModal={onOpenEventModal}
            onOpenAffectModal={onOpenAffectModal}
            onOpenSortieModal={onOpenSortieModal}
            onOpenReceptionModal={onOpenReceptionModal}
            onOpenRetourModal={onOpenRetourModal}
            onOrderArticle={onOrderArticle}
          />
        ) : null}
      </div>

      `;

c = c.slice(0, start) + block + c.slice(end);

if (!c.includes("<CdcModulePages")) {
  c = c.replace(
    "    </main>",
    `      {isCdcModulePage(activePage) && activePage !== "dashboard" && activePage !== "alertes" ? (
        <CdcModulePages
          activePage={activePage as CdcPageId}
          evenements={state.evenements.map((ev) => ({ id: ev.id, label: ev.nom }))}
          articles={state.articles}
        />
      ) : null}

    </main>`,
  );
}

fs.writeFileSync(path, c, "utf8");
console.log("patched MainContent.tsx");
