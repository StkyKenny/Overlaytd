import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  themeAlpine,
  RowSelectionOptions,
  IRowNode,
  ValueFormatterParams,
  CellStyle,
} from "ag-grid-community";
import { Component, inject, OnInit } from "@angular/core";
import { AgGridAngular } from "ag-grid-angular";
import { Astre, AstreID, astreKey } from "../../models/Astre";
import { ApiService } from "src/app/api.service";
import { RowModel, RowModelTransfer } from "src/app/models/RowModel";
import { ToastrService } from "ngx-toastr";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { ConfirmDialogComponent } from "src/app/shared/confirm-dialog.component";

import { Store } from "@ngrx/store";
import { selectAddAstreResult, selectAstres } from "src/app/store/astre.selectors";
import { Observable, take } from "rxjs";
import { ActionStatus } from "src/app/store/action.state";
import { SharedModule } from "src/app/shared.module";
import { offlineDb } from "src/app/db/offlineDb";
import { fromAstresToRows } from "src/app/utils/helper";
import { PAGE_DESCRIPTIONS } from "src/app/shared/page-descriptions";
import { PageInfoService } from "src/app/page-info.service";
import { toAstre } from "src/app/models/model-utils";
import { GridUserConfig } from "./grid.userconfig";

@Component({
  selector: "app-grid",
  standalone: true,
  imports: [AgGridAngular, SharedModule], //CommonModule required for ngFor
  templateUrl: "./grid.component.html",
  styleUrl: "./grid.component.css",
})
export class GridComponent implements OnInit {
  public allAstres$: Observable<Astre[]> = this.store.select(selectAstres);
  public addAstreResult$: Observable<ActionStatus> = this.store.select(selectAddAstreResult);

  // Row Data: The data to be displayed.
  count: number = 1;
  separator: string = "¤";

  test_function_name: string = "Reset to example";
  rowData: RowModel[] = [];
  astre2Service: ApiService = inject(ApiService); // Angular 14+, can only be run before or in constructor phase

  searchTerm: string = "";
  columnSearch = "";

  newItems: RowModel = {
    type: "type",
    subtype: "subtype",
    name: "name",
    subname: "",
    tags: "nidnf",
    link: "",
    description: "",
    parent: "dfsf",
    id: "",
    last_modified: "dfsf",
    date_added: "dfsf",
  };
  userKeys = Object.keys(this.newItems) as (keyof RowModel)[];
  selectedKey = "";

  defaultColDef: ColDef = {
    flex: 1,
    //minWidth: 150,
    editable: true,
    wrapText: true,
    autoHeight: true,
    filter: "agTextColumnFilter",
    suppressMovable: true,
    cellStyle: {
      "align-items": "center",
      display: "flex",
      "justify-content": "center",
      "white-space": "pre-wrap",
    },
  };

  theme = themeAlpine;
  colDefs = [
    {
      headerName: "Type",
      field: "type",
      maxWidth: 100,
      cellStyle: (): CellStyle => {
        return GridUserConfig.idCellStyle;
      },
      getQuickFilterText: (params: any) => {
        return params.value;
      }, // Why not in the default settings if applied to all ? I need rewrite this option each one separately
    },
    {
      headerName: "Subtype",
      field: "subtype",
      maxWidth: 100,
      cellStyle: (): CellStyle => {
        return GridUserConfig.idCellStyle;
      },
      getQuickFilterText: (params: any) => {
        return params.value;
      },
    },
    {
      headerName: "Name",
      field: "name",
      cellStyle: (): CellStyle => {
        return GridUserConfig.idCellStyle;
      },
      getQuickFilterText: (params: any) => {
        return params.value;
      },
    },
    {
      headerName: "Subname",
      field: "subname",
      getQuickFilterText: (params: any) => {
        return params.value;
      },
    },
    {
      headerName: "Tags",
      field: "tags",
      getQuickFilterText: (params: any) => {
        return params.value;
      },
    },
    {
      headerName: "Link",
      field: "link",
      wrapText: false,
      autoHeight: false,
      cellEditor: "agLargeTextCellEditor",
      getQuickFilterText: (params: any) => {
        return params.value;
      },
    },
    {
      headerName: "Description",
      field: "description",
      //minWidth: 400,
      getQuickFilterText: (params: any) => {
        return params.value;
      },
      cellEditor: "agLargeTextCellEditor",
      cellEditorPopup: false,
      cellEditorParams: {
        maxLength: 2000,
        rows: 20,
        cols: 100,
      },
      cellStyle: {
        "padding-top": "1px",
        "padding-bottom": "1px",
      },

      cellRenderer: (params: any) => {
        // Fool AG grid to render cell value as html
        return params.value;
      },
    },
    {
      headerName: "Parent",
      field: "parent",
      getQuickFilterText: (params: any) => {
        return params.value;
      },
    },
    {
      headerName: "Id",
      field: "id",
      wrapText: false,
      autoHeight: false,
      cellEditor: "agLargeTextCellEditor",
      maxWidth: 10, // Make it know data is here without revealing all of it
      getQuickFilterText: (params: any) => {
        return params.value;
      },
    },
    {
      headerName: "Date added",
      field: "date_added",
      hide: true,
    },
    {
      headerName: "Last Modified",
      field: "last_modified",
      hide: true,
    },
    {
      headerName: "Was Modified ?",
      field: "was_modified",
      //width: 30,
      hide: false,
    },
  ];
  rowSelection: RowSelectionOptions | "single" | "multiple" = {
    mode: "multiRow",
    selectAll: "filtered",
  };

  constructor(
    // API service is injected using inject() (Angular 14+), to be safe use constructor injection for external service
    private toastr: ToastrService,
    private modalService: NgbModal,
    private store: Store,
    private pageInfoService: PageInfoService,
  ) {}

  ngOnInit() {
    this.pageInfoService.updateInformation(PAGE_DESCRIPTIONS.grid);
    this.retrieveData();
  }

  private gridApi!: GridApi;

  gridOptions: GridOptions = {
    autoSizeStrategy: {
      //type: "fitCellContents",
      type: "fitGridWidth",
    },

    getRowId(params) {
      return astreKey(params.data);
    },
    onCellValueChanged(event) {
      let data = event.data;
      // Can't update when the rowID is being changed
      if (event.column.getColId() != "name") {
        if (event.column.getColId() != "was_modified") {
          let rowNode = event.api.getRowNode(astreKey(data))!;
          if (rowNode) {
            rowNode.setDataValue("was_modified", true);
          }
        }
      }
    },
  };

  onGridReady(evt: GridReadyEvent) {
    this.gridApi = evt.api;
  }
  /**
   * Quick Search in grid, can also filter put a specific column to search
   */
  onFilterTextBoxChanged(columnSearch: string): void {
    this.columnSearch = columnSearch;
    this.searchTerm = (document.getElementById("filter-text-box") as HTMLInputElement).value;

    this.colDefs.forEach((colDef) => {
      colDef.getQuickFilterText = (params: any) => {
        return params.value;
      };
      if (columnSearch) {
        if (colDef.field != columnSearch) {
          colDef.getQuickFilterText = (params: any) => {
            return "";
          };
        }
      }
    });
    this.gridApi!.setGridOption("columnDefs", this.colDefs);
    this.gridApi.setGridOption("quickFilterText", this.searchTerm);
  }

  async retrieveData() {
    if (this.rowData.length == 0) {
      this.astre2Service
        .getAstresAndLinks()
        .pipe(take(1))
        .subscribe({
          next: (astres) => {
            offlineDb.populateDb(astres);
            this.rowData = fromAstresToRows(astres);
          },
          error: (err) => {
            console.log(err);
            let offlineAstres: RowModelTransfer[] = [];
            offlineDb.getItems().then((astres) => {
              offlineAstres = fromAstresToRows(astres);
              if (offlineAstres.length > 0) {
                this.toastr.info("Using local offline database's save", "Error Fetching from server");
                this.rowData = offlineAstres;
              } else {
                this.toastr.error("Error Fetching from server");
              }
            });
          },
        });
    }
    offlineDb
      .getItems()
      .then((astreArray) => {
        this.rowData = fromAstresToRows(astreArray);
      })
      .catch((e) => {
        alert(e);
        throw e;
      });
  }

  async sendData() {
    console.log("SEND button!");

    if (!this.verifyIntegrity()) {
      return;
    }

    const astres: Astre[] = [];

    this.gridApi.forEachNode(function (node: IRowNode) {
      if (node.data.was_modified == true || node.isSelected()) {
        let item: RowModelTransfer = node.data;
        astres.push(toAstre(item));
      }
    });

    offlineDb.addItems(astres);

    this.astre2Service
      .postAstres(astres)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.gridApi.forEachNode((node: IRowNode) => {
            if (node.data.was_modified == true) {
              // Reset the was_modified attribute
              this.gridApi.getRowNode(node.data.name)!;
              node.setDataValue("was_modified", false);
              node.setSelected(false);
            }
          });
          this.toastr.success("A total of " + astres.length + " rows were sent", "Successful Update of data");
        },
        error: (err) => {
          this.toastr.error("Error sending data to Server");
        },
      });
  }

  addItems(type: string, tags: string, parent: string) {
    const newItems: RowModel[] = [
      {
        type: type ? type : "type" + this.count,
        subtype: "name" + this.count,
        name: "name" + this.count,
        subname: "",
        tags: tags,
        link: "",
        description: "",
        parent: parent,
        id: "",
        last_modified: "",
        date_added: "",
        was_modified: true,
      },
    ];
    this.gridApi.applyTransaction({
      add: newItems,
      addIndex: 0,
    }); //  it is a list of Row Nodes that were added, not row data
    this.count++;
  }
  clearAll() {
    this.rowData = [];
  }

  deleteSelected() {
    const selectedData = this.gridApi.getSelectedNodes();
    let count: number = 0;
    selectedData.forEach((node) => {
      let astreID: AstreID = {
        type: node.data.type,
        subtype: node.data.subtype,
        name: node.data.name,
      };
      offlineDb.deleteItem(astreID);
      (this.astre2Service
        .deleteAstre(node.data.type, node.data.subtype, node.data.name)
        .pipe(take(1))
        .subscribe({
          next: () => {},
          error: (err) => {
            console.error("Delete failed on server", err);
            return false;
          },
        })
        .unsubscribe(),
        console.log("Entry deleted!", node.data.type, " - ", node.data.name));
      this.gridApi.applyTransaction({
        remove: [selectedData[count].data],
      });
      count += 1;
    });
    this.toastr.success("A total of " + count + " rows were removed", "Successful deletion of data");
  }

  /**
   *
   * @returns If the rowNodes respect the data integrity
   */
  verifyIntegrity(): boolean {
    const duplicates: Set<string> = new Set();
    const ids: Set<string> = new Set();

    this.gridApi.forEachNode(function (node: IRowNode<RowModel>) {
      let astre = node.data;
      if (astre != undefined) {
        let id: string = astreKey(astre);
        if (!ids.has(id)) {
          ids.add(id);
        } else {
          duplicates.add(id);
        }
      }
    });

    if (duplicates.size == 0) {
      this.toastr.success("", "No duplicates found");
      return true;
    }
    this.toastr.error("Found these as duplicates : " + Array.from(duplicates).join("|"), "Duplicate found", {
      disableTimeOut: true,
    });
    return false;
  }

  /**
   * Before importing, ask if the data should overwrite/append/ or be cancelled
   *
   *
   */
  importCheck(newData: RowModelTransfer[]) {
    if (this.rowData.length == 0) {
      this.rowData = newData;
      return "yes";
    } else {
      const modalRef = this.modalService.open(ConfirmDialogComponent, {
        centered: true,
      });
      modalRef.componentInstance.message =
        "There was already data present. Do you wish to overwrite them ? (YES : overwrite | NO : append)";

      modalRef.result
        .then((result) => {
          if (result === "yes") {
            this.rowData = newData;
            this.toastr.success("Imported a total of " + newData.length + " rows", "Import Successful");
          } else if (result === "no") {
            this.rowData = newData.concat(this.rowData);
            this.toastr.success("Appended a total of " + newData.length + " rows", "Import Successful");
          } else {
            // cancel
            this.toastr.info("", "Import Cancelled");
          }
          return result;
        })
        .catch(() => {
          console.log("Modal dismissed");
          this.toastr.info("", "Import Cancelled");
        });
    }
    return "cancel";
  }

  async importData(event: any): Promise<void> {
    const file: File = event.target.files[0];
    if (!file) {
      this.toastr.info("Invalid File");
    }

    if (file.name.endsWith(".json")) {
      const reader: FileReader = new FileReader();
      reader.readAsText(file);
      reader.onload = (e: any) => {
        const text = e.target.result;
        let obj: Astre[] = JSON.parse(text);
        this.importCheck(fromAstresToRows(obj));
      };
    } else {
      // OLDER IMPLEMENTATION, keep for back compatibility
      const papa = await import("papaparse"); // Lazy import
      const reader: FileReader = new FileReader();
      reader.readAsText(file);
      reader.onload = (e: any) => {
        const csvText = e.target.result;
        // <-- Lazy import
        papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,

          complete: (result) => {
            const simplified: any[] = result.data;
            const trs: RowModelTransfer[] = simplified.map((line: any) => ({
              type: line["Type"] || "",
              subtype: line["Subtype"] || "",
              name: line["Name"] || "",
              subname: line["Subname"] || "",
              tags: line["Tags"] || "",
              link: line["Links"] || "",
              description: line["Description"] || "",
              parent: line["Parent"] || "",
              id: line["Id"] || "",
              date_added: line["Date added"] || "",
              last_modified: line["Last Modified"] || "",
              was_modified: false,
            }));
            this.importCheck(trs);
          },
        });
      };
    }
  }

  exportData() {
    let colDefsFields: string[] = [];
    this.colDefs.forEach((col) => colDefsFields.push(col.field));
    const astres: Astre[] = [];

    this.gridApi.forEachNode(function (node: IRowNode) {
      let item = node.data;
      astres.push({
        astreID: { type: item.type, subtype: item.subtype, name: item.name },
        subname: item.subname,
        tags: item.tags,
        link: item.link,
        description: item.description,
        parent: item.parent,
        id: item.id,
        date_added: item.date_added,
        last_modified: item.last_modified,
      });
    });
    const jsonStr = JSON.stringify(astres, null, 2); // pretty print with spaces
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    ((a.download = "exportGridData_" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + ".json"), a.click());

    window.URL.revokeObjectURL(url);
    return false;

    /*this.gridApi!.exportDataAsCsv({
      allColumns: true,
      skipColumnHeaders: false,
      fileName:
        "exportGridData_" +
        new Date().toISOString().slice(0, 10).replace(/-/g, "") +
        ".csv", //
      columnKeys: colDefsFields,
      suppressQuotes: false,
    });
   */
  }

  // UTILITIES
  test() {
    /*this.allAstres$.pipe(take(1)).subscribe((a) => console.log(a));
    let cnt = 0;
    this.astre2Service.getAstres().forEach((a) => (cnt += 1));
    console.log(cnt);
*/
  }
  loadExample() {
    this.astre2Service.getLocalAstres().subscribe({
      next: (text: Astre[]) => {
        this.rowData = fromAstresToRows(text);
      },
      error: (err) => console.error("Failed to load file:", err),
    });
  }
}
