import { Component, AfterViewInit, ElementRef, ViewChild, SimpleChanges, inject, HostListener } from "@angular/core";
import * as d3 from "d3";
import { ToastrService } from "ngx-toastr";
import { Astre, AstreID, astreIDKey, updateTags } from "src/app/models/Astre";

import { Tags } from "src/app/models/Tags";

import { linkConfig, rainbowLoop, tooltipConfig, treeConfig } from "./tree.config";
import { offlineDb } from "src/app/db/offlineDb";
import { ApiService } from "src/app/api.service";
import { PageInfoService } from "src/app/page-info.service";
import { PAGE_DESCRIPTIONS } from "src/app/shared/page-descriptions";
import { computeBranchColor } from "./tree-utils";
import TreeTemplates from "./tree-buttons";
import * as Tone from "tone";
import { StringInputDialogComponent } from "src/app/shared/string-input-dialog.component";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { take } from "rxjs";
import { SharedModule } from "src/app/shared.module";

@Component({
  selector: "app-tree",
  imports: [SharedModule], //CommonModule required for ngFor
  template: `
    <div class="tree-wrapper">
      <svg #svgContainer style="width:90vw; height:87vh;"></svg>
    </div>
    <div class="form-check form-switch">
      <input class="form-check-input" type="checkbox" role="switch" id="SwitchTextMirror" checked />
      <label class="form-check-label" for="SwitchTextMirror">Mirror text</label>
    </div>
    <p>
      <input
        type="range"
        style='transform", event.transform +  rotate(90)'
        id="slider"
        min="-190"
        max="190"
        step="1"
        [(ngModel)]="sliderValue"
        (wheel)="onSliderWheel($event)"
      />
      <input
        type="text"
        id="quickSearch"
        [(ngModel)]="quickSearchValue"
        placeholder="Quick search..."
        (ngModelChange)="onSearchChange()"
      />
    </p>
  `,
  styleUrl: "./tree.component.css",
})
export class TreeComponent implements AfterViewInit {
  @ViewChild("svgContainer", { static: true })
  svgRef!: ElementRef<SVGSVGElement>;

  public astres: Astre[];
  astreService: ApiService = inject(ApiService); // Angular 14+, can only be run before or in constructor phase

  childColumn = "";
  parentColumn = "";
  quickSearchValue: string = "";

  // Tooltip variables
  svgBounds: any;
  tooltipPinned: boolean = false;
  tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  tooltipAnchor: d3.HierarchyPointNode<Astre>;
  tooltipWrapper: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

  // TODO Put those in an array
  tooltipCloseButton: d3.Selection<HTMLButtonElement, unknown, HTMLElement, any>;
  tooltipTagSpreadButton: d3.Selection<HTMLButtonElement, unknown, HTMLElement, any>;
  tooltipTagRemovalSpreadButton: d3.Selection<HTMLButtonElement, unknown, HTMLElement, any>;
  tooltipPropagateTag: d3.Selection<HTMLButtonElement, unknown, HTMLElement, any>;

  // Slider
  sliderValue: number = 0;
  startingPitch: number = -10;
  maxPitch: number = 20;
  incrementPitch: number = 2;
  tickStep: number = 5;
  pitchShift: Tone.PitchShift;
  player: Tone.Player;
  lastRotationTick: number = 0;

  treeNodeText: any;
  root: d3.HierarchyNode<Astre>;
  nodeG: d3.Selection<SVGGElement | d3.BaseType, d3.HierarchyPointNode<Astre>, SVGGElement, unknown>;

  @HostListener("document:keydown", ["$event"])
  onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;

    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return;
    }

    if (event.key === "Backspace") {
      this.quickSearchValue = this.quickSearchValue.slice(0, -1);
      this.onSearchChange();
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    this.quickSearchValue += event.key;
    this.onSearchChange();
  }

  constructor(
    private toastr: ToastrService,
    private pageInfoService: PageInfoService,
    private modalService: NgbModal,
  ) {}

  ngOnInit() {
    this.pageInfoService.updateInformation(PAGE_DESCRIPTIONS.tree);
  }

  initDOM() {
    let treeTemplater = new TreeTemplates();
    this.tooltipWrapper = treeTemplater.tooltipWrapper;
    this.tooltip = treeTemplater.tooltip;
    this.tooltipCloseButton = treeTemplater.tooltipCloseButton.on("click", () => this.clearTooltip());
    this.tooltipTagSpreadButton = treeTemplater.tooltipSpreadTagButton.on("click", (event) =>
      this.spreadTagToDescendants(event),
    );

    this.tooltipTagRemovalSpreadButton = treeTemplater.tooltipSpreadTagRemovalButton.on("click", (event) =>
      this.blankButton(event),
    );
    //this.tooltipCloseButton = treeTemplater.tooltipPropagateButton.on("click", () => this.clearTooltip());
  }
  ngAfterViewInit(): void {
    const svgElement = this.svgRef.nativeElement as SVGSVGElement;
    // get actual pixel dimensions from browser layout
    this.svgBounds = svgElement.getBoundingClientRect();
    this.astreService
      .getAstresAndLinks()
      .pipe(take(1))
      .subscribe({
        next: (astres) => {
          this.astres = astres.filter((a) => a.astreID.type == "topic");
          this.initDOM();
          this.loadTree();
        },
        error: (err) => {
          this.astreService.getLocalAstres().subscribe({
            next: (text: Astre[]) => {
              this.astres = text;
              this.initDOM();
              this.loadTree();
            },
            error: (err) => console.error("Failed to load file:", err),
          });
        },
      });
    const slider = document.getElementById("slider");
    /*slider!.addEventListener(
      "input",
      //let sliderElement: HTMLInputElement = e.target as HTMLInputElement;
      async () => {
        await Tone.start();
        if (!this.pitchShift) {
          this.pitchShift = new Tone.PitchShift(this.startingPitch).toDestination();
        }
        if (!this.player) {
          this.player = new Tone.Player("../../assets/click.mp3").toDestination().connect(this.pitchShift);
        }
        this.lastRotationTick += this.incrementPitch;
        this.lastRotationTick %= this.tickStep;
        if (this.lastRotationTick == 0) {
          Tone.loaded().then(() => {
            this.player.start();
            if (this.pitchShift.pitch < this.maxPitch) {
              this.pitchShift.pitch += this.incrementPitch;
            }
          });
        }
      },
    );
    slider!.addEventListener("mouseup", (e: Event) => {
      this.pitchShift.pitch = this.startingPitch;
    });*/

    const SwitchTextMirror = document.getElementById("SwitchTextMirror") as HTMLInputElement;
    SwitchTextMirror!.addEventListener("input", (e: Event) => {
      if (SwitchTextMirror!.checked == true) {
        this.treeNodeText.attr(
          "transform",
          (d: d3.HierarchyPointNode<Astre>) => `rotate(${(d.x * 180) / Math.PI - 90})`,
        );
        this.treeNodeText.attr("text-anchor", "start");
      } else {
        this.treeNodeText.attr(
          "transform",
          (d: d3.HierarchyPointNode<Astre>) => `rotate(${(d.x * 180) / Math.PI - 90}) rotate( 180 )`,
        );
        this.treeNodeText.attr("text-anchor", "end");
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {}

  /**
   * Hide the tooltip
   * Also set pin flag to false
   */
  clearTooltip() {
    this.tooltipPinned = false;
    this.tooltipWrapper.style("display", "none");
    this.tooltipCloseButton.style("display", "none");
    this.tooltipTagSpreadButton.style("display", "none");
    this.tooltipTagRemovalSpreadButton.style("display", "none");
    this.tooltipWrapper.transition().duration(200).style("opacity", 0);
  }

  /**
   *
   *
   * @param event
   */
  spreadTagToDescendants(event: PointerEvent) {
    const modalRef = this.modalService.open(StringInputDialogComponent, {
      centered: true,
    });

    let rootAstreID = this.tooltipAnchor.data.astreID;
    modalRef.componentInstance.message =
      "What tag do you want to propagate to the descendants of : \n'" + JSON.stringify(rootAstreID, null, 2) + "'";

    modalRef.result
      .then((tagToAdd) => {
        if (tagToAdd == "") {
          this.toastr.info("", "Propagation Cancelled");
        } else {
          let astres = this.astreService.loadAstres();
          let propagationQueue: AstreID[] = [];
          propagationQueue.push(rootAstreID);
          let childrenMap = this.astreService.getChildren();

          let astresToUpdate: Astre[] = [];

          while (propagationQueue.length > 0) {
            let currentAstreID: AstreID | undefined = propagationQueue.pop();
            if (currentAstreID == undefined) {
              continue;
            }
            childrenMap.get(astreIDKey(currentAstreID))?.forEach((astreID) => {
              propagationQueue.push(astreID);

              let astreToUpdate = astres.get(astreIDKey(astreID!));
              if (astreToUpdate) {
                updateTags(astreToUpdate, [tagToAdd], []);
                astresToUpdate.push(astreToUpdate);
              }
            });
            currentAstreID = propagationQueue.pop();
          }
          this.astreService
            .postAstres(astresToUpdate)
            .pipe(take(1))
            .subscribe({
              next: (res) => console.log(res), //this.toastr.success("Correctly added the tag to all its descendants (" + res.length + ")"),
              error: (err) => this.toastr.error("error", err),
            });
        }
      })
      .catch(() => {
        console.log("Modal dismissed");
        this.toastr.info("", "Propagation Cancelled");
      });
    this.clearTooltip();
  }

  onSearchChange() {
    this.nodeG.select(".search-highlight").attr("opacity", (d) => (this.quickSearchFilter(d.data) ? 1 : 0));

    this.nodeG
      .select(".search-text-highlight")
      .attr("fill", (d) => (this.quickSearchFilter(d.data) ? "rgb(255, 0, 0)" : "rgb(0, 0, 0)"))

      .attr("font-weight", (d) =>
        this.quickSearchFilter(d.data) ? treeConfig.label.hightlightedWeight : treeConfig.label.defaultWeight,
      )
      .attr("opacity", (d) =>
        this.quickSearchFilter(d.data) ? treeConfig.label.hoverOpacity : treeConfig.label.defaultOpacity,
      );
  }

  quickSearchFilter(astre: Astre): boolean {
    let searchValue: string = this.quickSearchValue.trim().toLowerCase();
    if ("" == searchValue) {
      return false;
    }

    if (astre.astreID.name != null && astre.astreID.name.toLowerCase().includes(searchValue)) {
      return true;
    }
    if (astre.tags != null && astre.tags.toLowerCase().includes(searchValue)) {
      return true;
    }
    return false;
  }

  onSliderWheel(event: WheelEvent) {
    event.preventDefault();
    event.stopPropagation();
    let incrementValue = 5;

    if (event.deltaY > 0) {
      this.sliderValue += incrementValue;
    } else {
      this.sliderValue -= incrementValue;
    }
  }
  //  TODO add feature for this button
  blankButton(event: PointerEvent) {
    //
    const modalRef = this.modalService.open(StringInputDialogComponent, {
      centered: true,
    });

    modalRef.componentInstance.message = "This currently has no defined feature";

    modalRef.result
      .then((tagToAdd) => {})
      .catch(() => {
        console.log("Modal dismissed");
        this.toastr.info("", "Propagation Cancelled");
      });
    this.clearTooltip();
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
  renderTooltip(
    tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, undefined>,
    pointNode: d3.HierarchyPointNode<Astre>,
    event: MouseEvent,
    anchor: d3.HierarchyPointNode<Astre>,
    target: SVGElement,
  ) {
    tooltip.style("display", "block");
    tooltip.style("pointer-events", "block");
    let astre: Astre = pointNode.data as Astre;
    let astreTags = astre.tags;
    let additionalComments = "";

    let targetDOM: DOMRect = d3.select(target).node()!.getBoundingClientRect();
    let px = targetDOM.x;
    let py = targetDOM.y;

    const [x, y] = d3.pointRadial(anchor.x, anchor.y); // Relative coordinate to RootNode

    const node = tooltip.node() as HTMLElement; // cast
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
    const tooltipNode = tooltip
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
    tooltip
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

  /**
   * Pre-process the data before initializing the tree
   */
  loadTree() {
    if (this.astres.length === 0) {
      this.astreService.getLocalAstres().subscribe((astres: Astre[]) => {
        this.astres = astres;
        this.toastr.info("Using example data as replacement", "No data found");
        this.initTree(this.astres);
      });
    } else {
      this.initTree(this.astres);
    }
  }

  separation(a: Astre, b: Astre) {
    return a.parent == b.parent ? 1 : 2;
  }

  /**
   * Check if the data is valid for making a tree hierarchy
   * It checks for multiple roots and cycle in graph
   *
   * @returns True if the Data is valid, false otherwise
   */
  isValidData(): boolean {
    let roots = this.astres.filter((a) => a.parent == null || a.parent == "");
    if (roots.length > 1) {
      this.toastr.info(
        Array.from(roots)
          .map((a) => a.astreID.name)
          .join(" | "),
        "Invalid (Multiple roots found)",
        { disableTimeOut: true },
      );
      return false;
    }

    let visited: Set<Astre> = new Set(); // For cehcking cycle
    this.astres.forEach((a) => {
      let currentNode = a;
      let currentParent = a.parent;
      let visitedLocal: Set<Astre> = new Set(); // For cehcking cycle
      while (currentNode != null && currentParent != null && currentParent != "") {
        if (visited.has(currentNode)) {
          // No need to re-travel checked nodes
          break;
        }
        if (visitedLocal.has(currentNode)) {
          // Cycle found
          this.toastr.info(
            Array.from(visitedLocal.keys())
              .map((a) => a.astreID.name)
              .join(" | "),
            "Invalid (Cycle found)",
            { disableTimeOut: true },
          );
          return false;
        }
        visitedLocal.add(currentNode);

        currentParent = currentNode.parent;
        currentNode = this.astres.filter((a) => a.astreID.name == currentParent)[0];
      }
      visited = new Set<Astre>([...visited, ...visitedLocal]);
    });
    return true;
  }

  /**
   * Init a radial tree given the data
   *
   * @param astres List of astre that are correctly pre-processed
   */
  initTree(astres: Astre[]): void {
    let rootCheck = this.astres.filter((astre) => astre.parent == "");
    if (rootCheck.length > 1) {
      this.toastr.error(
        "Please only keep one root for the tree : " +
          Array.from(rootCheck.map((astre) => astre.astreID.type + "-" + astre.astreID.name)).join(" | "),
        "Multiple Roots found",
        { disableTimeOut: true },
      );
    }

    this.childColumn = "astreid.name";
    this.parentColumn = "parent";

    if (!this.isValidData()) {
      return;
    }

    // === Create Tree ===

    this.root = d3
      .stratify<Astre>()
      .id((d: Astre) => d.astreID.name)
      .parentId((d: Astre) => d.parent)(astres);

    let radius = 10 * astres.length + Math.log(50 * astres.length) + 500;
    radius = radius < 200 ? 200 : radius;

    const tree = d3
      .tree<Astre>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5) / Math.min(a.depth, b.depth + 1));
    const rootPoint = tree(this.root as d3.HierarchyNode<Astre>);

    // === Select SVG and zoom  ===
    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3.select(this.svgRef.nativeElement);
    const g: d3.Selection<SVGGElement, unknown, null, undefined> = svg.append("g");

    let rotationValue = 0;
    let currentTransform = "";

    function updateViewTransform() {
      g.attr("transform", currentTransform + " rotate(" + rotationValue + " )");
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.02, 10])
      .on("zoom", (event) => {
        currentTransform = event.transform;
        updateViewTransform();
      });
    // Attach zoom
    svg.call(zoom);

    // Apply initial transform to center the content
    const initialTransform = d3.zoomIdentity
      .translate(this.svgBounds.width / 2, this.svgBounds.height / 2) // move to screen center
      .scale(1);

    svg.call(zoom.transform, initialTransform);

    d3.select("#slider").on("wheel", (e: Event) => {
      rotationValue = Number(this.sliderValue);
      updateViewTransform();
    });

    // === Links  ===
    const linkGen = d3
      .linkRadial<unknown, d3.HierarchyPointNode<Astre>>()
      .angle((d) => d.x)
      .radius((d: d3.HierarchyPointNode<Astre>) => d.y);
    const links = g
      .selectAll(".link")
      .data(rootPoint.links()) // gives array of {source, target}
      .join("path")
      .attr("class", "link")
      .attr("fill", "none") // mandatory in this style of links
      .attr("d", (link: d3.HierarchyPointLink<Astre>) => linkGen(link))
      .attr("stroke", (link: d3.HierarchyPointLink<Astre>) => {
        return computeBranchColor(link); //d3.hsl(0, 1, 0.9, 1).darker(d.target.depth).clamp().formatHsl();
      })
      .attr("stroke-width", linkConfig.stroke.width);
    // Draw nodes
    this.nodeG = g
      .append("g")
      .selectAll("g.node")
      .data(rootPoint.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d: d3.HierarchyPointNode<Astre>) => {
        const [x, y] = d3.pointRadial(d.x, d.y);
        return `translate(${x},${y})`;
      });

    this.nodeG.append("circle").attr("r", 15).attr("opacity", 0); // Fake increased hitbox
    this.nodeG.append("circle").attr("r", 3).attr("opacity", 0.5);
    this.treeNodeText = this.nodeG
      .append("text")
      .attr("class", "search-text-highlight")
      .attr("dy", -10)
      .text((d: d3.HierarchyPointNode<Astre>) => {
        return d.id ?? null;
      })
      .attr("opacity", treeConfig.label.defaultOpacity)
      .attr("font-weight", treeConfig.label.defaultWeight)
      .attr("transform", (d) => `rotate(${(d.x * 180) / Math.PI - 90})`) // Taken from https://observablehq.com/@d3/radial-tree/2.attr
      .attr("fill", "#000000ff");

    this.nodeG
      .append("circle")
      .attr("class", "search-highlight")
      .attr("r", 10)
      .attr("fill", "#FF0000")
      .attr("opacity", (d) => (this.quickSearchFilter(d.data) ? 1 : 0));
    // Node Events
    this.nodeG
      .on("click", (event: MouseEvent, pointNode: d3.HierarchyPointNode<Astre>) => {
        let target = event.currentTarget as SVGElement;

        this.tooltipCloseButton.style("display", "block");
        this.tooltipTagSpreadButton.style("display", "block");
        this.tooltipTagRemovalSpreadButton.style("display", "block");
        const anchor = this.nodeG
          .select("circle")
          .filter((node: d3.HierarchyPointNode<Astre>) => node.data.astreID == pointNode.data.astreID)
          .data()[0];
        this.renderTooltip(this.tooltip, pointNode, event, anchor, target);
        this.tooltip.transition().duration(200).style("opacity", 0.9);
        this.tooltipPinned = true;

        let currentNode = pointNode;
        while (currentNode.parent != null) {
          links
            .filter((s) => s.target == currentNode) // Bad for optimisation to not filter, but helps against race-condition/double-trigger
            .transition()
            .attr("stroke-width", linkConfig.stroke.width);
          currentNode = currentNode.parent;
        }
      })

      .on("mouseover", (event: MouseEvent, pointNode: d3.HierarchyPointNode<Astre>) => {
        let target = event.currentTarget as SVGElement;

        // Rainbow Path
        linkConfig.stroke.rainbowLoop = true;
        let currentNode = pointNode;
        while (currentNode.parent != null) {
          links
            .filter((s: d3.HierarchyPointLink<Astre>) => s.target == currentNode)
            .transition()
            .attr("stroke-width", linkConfig.stroke.widthHover)
            .transition()
            .on("end", function (link: d3.HierarchyPointLink<Astre>) {
              const sel = d3.select<SVGPathElement, d3.HierarchyLink<Astre>>(this as SVGPathElement);
              rainbowLoop(sel, "stroke", link);
            });
          currentNode = currentNode.parent;
        }

        const g = d3.select(target);
        g.select("text")
          .transition()
          .ease(d3.easeExpOut)
          .attr("opacity", treeConfig.label.hoverOpacity)
          .attr("font-weight", treeConfig.label.hoverWeight);

        this.tooltipWrapper.style("display", "block");
        this.tooltipWrapper.transition().duration(200).style("opacity", 0.9);
        if (!this.tooltipPinned) {
          this.tooltipAnchor = this.nodeG
            .select("circle")
            .filter((node: d3.HierarchyPointNode<Astre>) => node.data.astreID == pointNode.data.astreID)
            .data()[0];
          // Show tooltip
          this.renderTooltip(this.tooltip, pointNode, event, this.tooltipAnchor, target);
        }
      })

      .on("mouseout", (event: any, pointNode: d3.HierarchyPointNode<Astre>) => {
        if (!this.tooltipPinned) {
          this.clearTooltip();
        }
        let target: Element = event.currentTarget;

        // Clear Rainbow path
        linkConfig.stroke.rainbowLoop = false;
        let currentNode = pointNode;
        while (currentNode.parent != null) {
          links
            .filter((s) => s.target == currentNode) // Bad for optimisation to not filter, but helps against race-condition/double-trigger
            .transition()
            .attr("stroke-width", linkConfig.stroke.width)
            .attr("stroke", (link: d3.HierarchyPointLink<Astre>) => {
              return computeBranchColor(link);
            });
          currentNode = currentNode.parent;
        }

        const g = d3.select(target);
        g.select("text")
          .transition()
          .ease(d3.easeExpOut)
          .attr("opacity", treeConfig.label.defaultOpacity)
          .attr("fill", "#000000ff")
          .attr("font-weight", treeConfig.label.defaultWeight);
      });
  }
}
