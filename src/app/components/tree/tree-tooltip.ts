import * as d3 from "d3";
import { Astre } from "src/app/models/Astre";
import { Tags } from "src/app/models/Tags";
import { tooltipConfig } from "./tree.config";
import TreeTemplates from "./tree-buttons";

export class TreeTooltip {
  tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  tooltipAnchor: d3.HierarchyPointNode<Astre>;

  private tooltipWrapper: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  private tooltipCloseButton: d3.Selection<HTMLButtonElement, unknown, HTMLElement, any>;
  private tooltipTagSpreadButton: d3.Selection<HTMLButtonElement, unknown, HTMLElement, any>;
  private tooltipTagRemovalSpreadButton: d3.Selection<HTMLButtonElement, unknown, HTMLElement, any>;
  private tooltipPropagateTag: d3.Selection<HTMLButtonElement, unknown, HTMLElement, any>;

  constructor() {
    this.initDOM();
  }

  /**
   * Hide the tooltip
   * Also set pin flag to false
   */
  clearTooltip(): boolean {
    this.tooltipWrapper.style("display", "none");
    this.tooltipCloseButton.style("display", "none");
    this.tooltipTagSpreadButton.style("display", "none");
    this.tooltipTagRemovalSpreadButton.style("display", "none");
    this.tooltipWrapper.transition().duration(200).style("opacity", 0);
    return false;
  }

  showButtons() {
    this.tooltipCloseButton.style("display", "block");
    this.tooltipTagSpreadButton.style("display", "block");
    this.tooltipTagRemovalSpreadButton.style("display", "block");
  }

  showToolTip() {
    this.tooltipWrapper.style("display", "block");
    this.tooltipWrapper.transition().duration(200).style("opacity", 0.9);
  }
  addLogicToTagSpreadButton(logic: (event: MouseEvent) => void) {
    let treeTemplater = new TreeTemplates();
    this.tooltipTagSpreadButton = treeTemplater.tooltipSpreadTagButton.on("click", logic);
  }
  addLogicToTagRemovalSpreadButton(logic: (event: MouseEvent) => void) {
    let treeTemplater = new TreeTemplates();
    this.tooltipTagRemovalSpreadButton = treeTemplater.tooltipSpreadTagRemovalButton.on("click", logic);
  }

  initDOM() {
    let treeTemplater = new TreeTemplates();
    this.tooltipWrapper = treeTemplater.tooltipWrapper;
    this.tooltip = treeTemplater.tooltip;
    this.tooltipCloseButton = treeTemplater.tooltipCloseButton.on("click", () => this.clearTooltip());
  }
  /**
   * Render a tooltip given the data provided by pointNode
   *
   * @param tooltip The tooltip that will be rendered
   * @param pointNode The node with the data to display
   * @param event The event produced
   * @param anchor The node used as a reference for coordinates
   *
   */
  renderTooltip(pointNode: d3.HierarchyPointNode<Astre>, event: MouseEvent, target: SVGElement) {
    this.tooltip.style("display", "block");
    this.tooltip.style("pointer-events", "block");
    let astre: Astre = pointNode.data as Astre;
    let astreTags = astre.tags;
    let additionalComments = "";

    let targetDOM: DOMRect = d3.select(target).node()!.getBoundingClientRect();
    let px = targetDOM.x;
    let py = targetDOM.y;

    const [x, y] = d3.pointRadial(this.tooltipAnchor.x, this.tooltipAnchor.y); // Relative coordinate to RootNode

    const node = this.tooltip.node() as HTMLElement; // cast
    let isLeft = false; //x < 0;
    let isUp = y < 0;

    if (astre.tags == null || astre.tags.length == 0) {
      astreTags = "<span style='color:LightGrey;'>No Tags Found</span>";
    } else {
      // === Custom Tooltip comments based on tags ===
      let tagsList = astreTags.split(",");
      for (let tagName of tagsList) {
        switch (tagName.toLowerCase()) {
          case Tags.HighlightedList.toLowerCase(): {
            additionalComments +=
              "</br><span style='font-style:italic;'>This Node only has the most impactful entries (non-exhaustive)</span>";
            break;
          }
          case Tags.ExternalList.toLowerCase(): {
            additionalComments +=
              "</br><span style='font-style:italic;'>This Node possess an external list that isn't hosted on this site (Please refer to the description)</span>";
            break;
          }
          default: {
            break;
          }
        }
      }
    }

    if (astre.link == null || astre.link == "" || astre.link == " ") {
    } else {
      console.log(astre.astreID.name);
      console.log(astre.link);
      console.log(typeof astre.link);
      additionalComments +=
        '<iframe height="240" width="480" [src]="\"' +
        astre.link +
        '\"" loading="lazy"                  frameborder="1"                  allowfullscreen                  allow="autoplay"                ></iframe>';
    }

    // ==================
    const tooltipNode = this.tooltip
      .style("white-space", "pre-line")
      .style("line-height", "0.75")
      .style("overflow-wrap", "break-word")
      .html(
        `<b>${astre.astreID.name}</b></br>
            <span style='font-size:${tooltipConfig.comment.font.size}px'>[${astreTags}] in ${astre.parent} </span> </br>
            ${astre.description} </br>
            <span style='font-size:${tooltipConfig.comment.font.size}px'>${additionalComments} </span>`,
      )
      .node();
    if (!node) return; // nothing to do if tooltip not rendered
    const tooltipBox = tooltipNode!.getBoundingClientRect();
    let widthOffset = tooltipBox.width + 10;
    let buttonToTooltipVerticalOffset = 35;
    let tooltipHorizontalOffset = 10;
    this.tooltip
      .style("left", isLeft ? px - widthOffset + `px` : px + targetDOM.width + tooltipHorizontalOffset + `px`)
      .style("top", isUp ? py + "px" : py + targetDOM.height - buttonToTooltipVerticalOffset + "px")
      .style("text-align", isLeft ? "end" : "start");
    if (event instanceof PointerEvent) {
      // Clicked instance
      // !! Creating additional DOM on each 'hover' event causes performance issue, so the close button DOM element only appear on clicked
      let buttonsOffset = 0;
      this.tooltipWrapper.style("pointer-events", "auto");
      let tooltipCloseButtonNode = this.tooltipCloseButton.node();
      if (!tooltipCloseButtonNode) return; // nothing to do if tooltip not rendered
      this.tooltipCloseButton
        .style("opacity", 1)
        .style(
          "left",
          isLeft
            ? px - tooltipCloseButtonNode.getBoundingClientRect().width - tooltipHorizontalOffset + `px`
            : px + targetDOM.width + tooltipHorizontalOffset + `px`,
        )
        .style(
          "top",
          isUp
            ? py - buttonToTooltipVerticalOffset + "px"
            : py - 35 + targetDOM.height - buttonToTooltipVerticalOffset + "px",
        );
      buttonsOffset += tooltipCloseButtonNode.getBoundingClientRect().width + 10;
      this.tooltipWrapper.style("pointer-events", "auto");
      let tooltipTagSpreadButtonNode = this.tooltipCloseButton.node();
      if (!tooltipTagSpreadButtonNode) return; // nothing to do if tooltip not rendered
      this.tooltipTagSpreadButton
        .style("opacity", 1)
        .style(
          "left",
          isLeft
            ? px -
                tooltipTagSpreadButtonNode.getBoundingClientRect().width -
                tooltipHorizontalOffset +
                buttonsOffset +
                `px`
            : px + targetDOM.width + tooltipHorizontalOffset + buttonsOffset + `px`,
        )
        .style(
          "top",
          isUp
            ? py - buttonToTooltipVerticalOffset + "px"
            : py - 35 + targetDOM.height - buttonToTooltipVerticalOffset + "px",
        );

      buttonsOffset += tooltipCloseButtonNode.getBoundingClientRect().width + 10; // TODO MAKE IT A LOOP
      this.tooltipTagRemovalSpreadButton
        .style("opacity", 1)
        .style(
          "left",
          isLeft
            ? px -
                tooltipTagSpreadButtonNode.getBoundingClientRect().width -
                tooltipHorizontalOffset +
                buttonsOffset +
                `px`
            : px + targetDOM.width + tooltipHorizontalOffset + buttonsOffset + `px`,
        )
        .style(
          "top",
          isUp
            ? py - buttonToTooltipVerticalOffset + "px"
            : py - 35 + targetDOM.height - buttonToTooltipVerticalOffset + "px",
        );
    }
  }
}
