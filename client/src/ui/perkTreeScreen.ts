import { PERKS, perkTier } from "@nightfall/shared/systems/perks";
import type { Perk } from "@nightfall/shared/types";

// Read-only review screen — groups every perk by dependency depth (tier 0 =
// no prerequisites) so the whole tree can be eyeballed for correctness in
// one place, rather than only discovering a bad prerequisite mid-run.
export class PerkTreeScreen {
  private root: HTMLDivElement;

  constructor(container: HTMLElement, onBack: () => void) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";

    const tiers = new Map<number, Perk[]>();
    for (const perk of PERKS) {
      const tier = perkTier(perk.id);
      if (!tiers.has(tier)) tiers.set(tier, []);
      tiers.get(tier)!.push(perk);
    }

    const rowsHtml = [...tiers.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tier, perks]) => {
        const cards = perks
          .map((perk) => {
            const requiresText = perk.requires && perk.requires.length > 0 ? `Requires: ${perk.requires.map((id) => PERKS.find((p) => p.id === id)?.name ?? id).join(", ")}` : "Base perk";
            return `
              <div class="perk-tree-card">
                <svg class="perk-tree-card-icon" viewBox="0 0 24 24">${perk.icon}</svg>
                <div class="perk-tree-card-name">${perk.name}</div>
                <div class="perk-tree-card-desc">${perk.description}</div>
                <div class="perk-tree-card-requires">${requiresText}</div>
              </div>
            `;
          })
          .join("");
        return `
          <div class="perk-tree-row">
            <div class="perk-tree-row-label">Tier ${tier}</div>
            <div class="perk-tree-row-cards">${cards}</div>
          </div>
        `;
      })
      .join("");

    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 36px; letter-spacing: 3px;">PERK TREE</h1>
      <p class="overlay-subtitle">Every perk, grouped by how deep its prerequisite chain runs.</p>
      <div class="perk-tree-rows">${rowsHtml}</div>
      <button class="overlay-button perk-tree-back-button">BACK</button>
    `;
    this.root.querySelector(".perk-tree-back-button")!.addEventListener("click", onBack);
    container.appendChild(this.root);
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}
