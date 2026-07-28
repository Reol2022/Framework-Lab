import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const lab = path.resolve(".");
const frameworkId = "ncom";
const commit = "a350b576bbeae6c6254273037a17d2a8730fb80f";
const learning = path.join(lab, "frameworks", frameworkId, "learning");
const currentCatalog = JSON.parse(await readFile(path.join(lab, "frameworks", frameworkId, "catalog", "current.json"), "utf8"));
const currentSymbols = JSON.parse(await readFile(path.join(lab, "frameworks", frameworkId, "symbols", "current.json"), "utf8"));
const componentData = JSON.parse(await readFile(path.join(lab, "frameworks", frameworkId, "symbols", "snapshots", currentSymbols.snapshotId, "components.json"), "utf8")).components;
const bundleDirs = await readdir(path.join(learning, "bundles"));
const output = path.join(lab, ".tmp", "v0.2.3-drafts");
await mkdir(output, { recursive: true });

const specs = [
  {
    topicId: "lifecycle-callbacks",
    id: "ncom-lifecycle-callback-structure",
    type: "lifecycle",
    title: "NCom lifecycle callback structure",
    summary: "NComponent 的基类与构造阶段结构，范围限定于锁定 commit 的证据片段。",
    claim: "NComponent extends HTMLElement；所给构造函数片段创建 EventManager 并以 open 模式 attachShadow。",
    packages: ["package-ncom-core"],
    tags: ["mechanism", "lifecycle"],
  },
  {
    topicId: "template-rendering",
    id: "ncom-template-rendering-structure",
    type: "framework_concept",
    title: "NCom template and rendering structure",
    summary: "NComponent 模板片段、挂载状态、root 与 Shadow DOM 的结构化证据。",
    claim: "NComponent 声明 _templateFrag、_mounted 和 root 成员，构造阶段创建 open ShadowRoot。",
    packages: ["package-ncom-core"],
    tags: ["mechanism", "template", "render"],
  },
  {
    topicId: "props-reflection",
    id: "ncom-props-declaration-structure",
    type: "framework_concept",
    title: "NCom props declaration and reflection structure",
    summary: "组件 Props 接口以可选字段描述组件输入的源码证据。",
    claim: "TourProps、WatermarkProps 和 StatisticProps 的所给证据片段均以 TypeScript interface 声明可选属性。",
    packages: ["package-ncom-components"],
    tags: ["mechanism", "props"],
  },
  {
    topicId: "theme-style-entry",
    id: "ncom-theme-style-verification-structure",
    type: "build_workflow",
    title: "NCom theme and component style entry structure",
    summary: "当前 Framework Lab 配置与 Run 证据中可定位的样式相关验证边界。",
    claim: "锁定的 Framework Lab 配置把 install、lint、build 作为顺序 baseline steps，并将 build 标记为必需步骤。",
    packages: ["package-ncom-theme", "package-ncom-all"],
    tags: ["mechanism", "style", "theme", "validation"],
  },
  {
    topicId: "family-input-controls",
    id: "ncom-family-input-controls",
    type: "framework_concept",
    title: "NCBaseInput component family",
    summary: "经显式复核、共享 NCBaseInput 基类结构信号的组件家族。",
    claim: "复核成员在锁定 Symbol Snapshot 中共享 base:NCBaseInput 结构信号。",
    familyReview: "family-base-ncbaseinput-992f1bdb",
    tags: ["family", "input"],
  },
  {
    topicId: "family-closable",
    id: "ncom-family-closable-feedback-overlay",
    type: "event_pattern",
    title: "Closable feedback and overlay family",
    summary: "经显式复核、共享 close 事件结构信号的 NCAlert、NCDrawer 与 NCModal 家族。",
    claim: "NCAlert、NCDrawer 与 NCModal 在锁定 Symbol Snapshot 中都登记了 close 事件。",
    familyReview: "family-event-close-f995da3e",
    tags: ["family", "event", "close"],
  },
  {
    topicId: "family-reference-popup",
    id: "ncom-family-reference-popup",
    type: "framework_concept",
    title: "Reference-anchored popup family",
    summary: "经显式复核、共享 reference slot 结构信号的 NCPopmenu 与 NCPopover 家族。",
    claim: "NCPopmenu 与 NCPopover 在锁定 Symbol Snapshot 中都登记了 reference slot。",
    familyReview: "family-slot-reference-b8102051",
    tags: ["family", "popup", "slot"],
  },
  {
    topicId: "ncselect-api",
    id: "ncom-ncselect-structure",
    type: "component_api",
    title: "NCSelect public structure",
    summary: "NCSelect 的公共可达性、基类、事件、文档和示例索引。",
    component: "NCSelect",
    tags: ["component", "input", "select"],
  },
  {
    topicId: "nccheckbox-api",
    id: "ncom-nccheckbox-structure",
    type: "component_api",
    title: "NCCheckbox public structure",
    summary: "NCCheckbox 的公共可达性、基类、事件、slot、文档和示例索引。",
    component: "NCCheckbox",
    tags: ["component", "input", "checkbox"],
  },
  {
    topicId: "ncalert-api",
    id: "ncom-ncalert-structure",
    type: "component_api",
    title: "NCAlert public structure",
    summary: "NCAlert 的公共可达性、close 事件、文档和示例索引。",
    component: "NCAlert",
    tags: ["component", "feedback", "alert"],
  },
  {
    topicId: "ncdrawer-api",
    id: "ncom-ncdrawer-structure",
    type: "component_api",
    title: "NCDrawer public structure",
    summary: "NCDrawer 的公共可达性、open/close 事件、default slot、文档和示例索引。",
    component: "NCDrawer",
    tags: ["component", "overlay", "drawer"],
  },
  {
    topicId: "nccard-api",
    id: "ncom-nccard-structure",
    type: "component_api",
    title: "NCCard public structure",
    summary: "NCCard 的公共可达性、default/header/footer slots、文档和示例索引。",
    component: "NCCard",
    tags: ["component", "container", "card"],
  },
  {
    topicId: "nctable-api",
    id: "ncom-nctable-structure",
    type: "component_api",
    title: "NCTable public structure",
    summary: "NCTable 的公共可达性、行事件、default slot、文档和示例索引。",
    component: "NCTable",
    tags: ["component", "complex", "table"],
  },
  {
    topicId: "event-state-update",
    id: "ncom-event-state-update-workflow",
    type: "event_pattern",
    title: "Event-driven state update workflow",
    summary: "使用 nc-change 事件 detail 连接组件值变化与调用方状态更新的证据边界。",
    claim: "createChangeEvent 创建名为 nc-change 的 CustomEvent，并把 ChangeEventDetail 放入 detail。",
    packages: ["package-ncom-components"],
    tags: ["workflow", "event", "state"],
    recipe: ["订阅组件的 nc-change 事件。", "从事件 detail 读取值并更新调用方状态。"],
  },
  {
    topicId: "public-import-types",
    id: "ncom-public-import-type-location-workflow",
    type: "development_convention",
    title: "Public import and type location workflow",
    summary: "从 package exports 和类型声明定位公共导入与 Props 类型的证据。",
    claim: "@ncom/components 的 package exports 为根入口登记 dist/index.js，并为 types 登记 dist/types/index.d.ts。",
    packages: ["package-ncom-components"],
    tags: ["workflow", "public-api", "types"],
    recipe: ["先检查目标 package 的 exports/types。", "再用 Symbol Snapshot 确认目标类型的公共可达性。"],
  },
  {
    topicId: "theme-example-chain",
    id: "ncom-theme-example-build-chain-workflow",
    type: "build_workflow",
    title: "Theme and example dependency chain",
    summary: "Framework Lab 配置、Run 与 example 包脚本共同限定的构建验证链证据。",
    claim: "当前 baseline 配置以固定 pnpm 执行 install、lint:eslint 和 build；example/package.json 另登记 dev 与 build 脚本。",
    packages: ["package-ncom-all", "package-ncom-theme"],
    tags: ["workflow", "theme", "example", "build"],
    recipe: ["先保留固定 pnpm 与锁文件安装证据。", "再执行 lint 与必需 build，并把 example 行为验证单独记录。"],
  },
];

function bundleFor(topicId) {
  const prefix = `bundle-${topicId}-`;
  const matches = bundleDirs.filter((item) => item.startsWith(prefix)).sort();
  if (matches.length !== 1) throw new Error(`${topicId}: expected exactly one bundle, got ${matches.length}`);
  return matches[0];
}

for (const spec of specs) {
  const bundleId = bundleFor(spec.topicId);
  const evidenceFile = JSON.parse(await readFile(path.join(learning, "bundles", bundleId, "evidence.json"), "utf8"));
  const evidenceIds = evidenceFile.evidence.map((item) => item.id);
  let relatedComponents = [];
  let relatedSymbols = [];
  let relatedPackages = spec.packages ?? [];
  let claim = spec.claim;
  const limitations = ["仅适用于锁定 commit 与所列 Evidence；不推断未提供的运行时行为。"];
  if (spec.component) {
    const component = componentData.find((item) => item.name === spec.component);
    if (!component) throw new Error(`missing component ${spec.component}`);
    relatedComponents = [component.id];
    relatedSymbols = [component.symbolId, ...component.props];
    relatedPackages = [component.packageId];
    claim = `${component.name} 在锁定 Symbol Snapshot 中公共可达，继承 ${component.baseTypes.join(", ") || "未记录基类"}；登记事件 ${component.events.join(", ") || "无"}，slots ${component.slots.join(", ") || "无"}，文档 ${component.documents.length} 个，示例文件 ${component.examples.length} 个。`;
    limitations.push("结构索引不等同于浏览器行为或视觉回归验证。");
  }
  if (spec.familyReview) {
    const review = JSON.parse(await readFile(path.join(learning, "families", "reviews", `${spec.familyReview}.json`), "utf8"));
    relatedComponents = review.approvedComponentIds;
    relatedSymbols = componentData.filter((item) => relatedComponents.includes(item.id)).map((item) => item.symbolId);
    relatedPackages = [...new Set(componentData.filter((item) => relatedComponents.includes(item.id)).map((item) => item.packageId))];
    limitations.push(...review.limitations);
  }
  const claimId = `${spec.id}-claim-1`;
  const unit = {
    schemaVersion: "1.0.0",
    id: spec.id,
    frameworkId,
    type: spec.type,
    title: spec.title,
    summary: spec.summary,
    scope: {
      sourceCommit: commit,
      catalogRootHash: currentCatalog.rootHash,
      symbolRootHash: currentSymbols.rootHash,
    },
    relatedPackages,
    relatedSymbols: [...new Set(relatedSymbols)],
    relatedComponents,
    prerequisites: [],
    claims: [{
      id: claimId,
      text: claim,
      status: "observed",
      confidence: "high",
      evidenceIds,
      appliesTo: [commit],
      exceptions: [],
      limitations,
      tags: spec.tags,
    }],
    recipes: spec.recipe ? [{
      id: `${spec.id}-recipe-1`,
      steps: spec.recipe,
      evidenceIds,
      limitations: ["步骤是证据约束的最小流程，不替代目标项目的验收标准。"],
    }] : [],
    constraints: [],
    limitations,
    evidence: evidenceIds.map((id) => ({ id })),
    sourceBundleId: bundleId,
    generator: "manual-evidence-normalization-v0.2.3",
    reviewStatus: "pending",
    publicationStatus: "draft",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
  };
  await writeFile(path.join(output, `${spec.id}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({ output, drafts: specs.map((item) => ({ id: item.id, bundleId: bundleFor(item.topicId) })) }, null, 2));
