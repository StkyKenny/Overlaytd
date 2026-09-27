import { Component } from "@angular/core";

import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ApiService } from "./api.service";
import { Observable } from "rxjs";
import { ToastrService } from "ngx-toastr";
import { HttpClient } from "@angular/common/http";
import { MediaDockComponent } from "./components/media-dock/media-dock.component";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { InfoDialogComponent } from "./shared/info-dialog";
import { PageInfoService } from "./page-info.service";
@Component({
  selector: "app-root",
  imports: [RouterModule, CommonModule, MediaDockComponent],
  template: `
    <!--<button id="sidebarhelper" class="sidebarhelper toggle-btn btn btn-light" (click)="toggleSidebar()">></button>
    
    <button id="collapsezone" class="collapsezone" (click)="toggleSidebar()"></button>-->

    <button id="collapsezone" class="collapsezone"></button>

    <div id="sidebar" class="sidebar" (mouseenter)="toggleSidebar(true)" (mouseleave)="toggleSidebar(false)">
      <p>
        <br />
        <a routerLink="/login">Login</a>
        <br />
        <br />
        <a routerLink="/grid">Grid</a>
        <br />
        <a routerLink="/tags-manager">Tags</a>
        <br />
        <a routerLink="/tree">Tree</a>
      </p>
      <p *ngIf="this.auth.isLoggedIn$ | async">
        <a routerLink="/home">Home</a>
        <br />
        <br />
        <a routerLink="/home" (click)="logout()">Logout</a>
      </p>
    </div>

    <main class="content">
      <header class="brand-name" style="height: 8vh;">
        <div class="d-flex flex-row-reverse bd-highlight">
          <!--<div class="p-2 w-100 bd-highlight">
            <i class="bi bi-house-door-fill cns-gradient" style="font-size: 2rem;" aria-hidden="true" (click)="rdm()">
              <span class="cns-gradient cns-gradient-text-strech"> RELAYTD</span>
            </i>
          </div>-->

          <div class="p-2 bd-highlight">
            <i class="bi bi-info-circle" (click)="getPageInfo()" style="font-size: 1.5rem;"></i>
          </div>
        </div>
      </header>
      <app-media-dock></app-media-dock>
      <section class="content">
        <router-outlet></router-outlet>
        <!-- Dynamic load based on route -->
      </section>
    </main>
  `,
  styleUrls: ["./app.component.css"],
})
//replaced the <app-home></app-home> tag with the <router-outlet> directive
export class AppComponent {
  title = "homes";
  isLoggedIn$: Observable<boolean>;
  pageDescription = "No page description found";

  constructor(
    public auth: ApiService,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private pageInfoService: PageInfoService,
  ) {
    this.isLoggedIn$ = this.auth.isLoggedIn$;
  }

  ngOnInit(): void {
    this.pageInfoService.pageInformation$.subscribe((description: string) => {
      this.pageDescription = description;
    });
  }

  logout(): void {
    localStorage.clear();
    this.auth.logout();
  }
  toggleSidebar(forceStateCollape: boolean) {
    const sidebar = document.getElementById("sidebar");
    //const sidebarhelper = document.getElementById("sidebarhelper");
    const collapsezone = document.getElementById("collapsezone");

    sidebar!.classList.toggle("uncollapsed", forceStateCollape);
    //sidebarhelper!.classList.toggle("uncollapsed", forceStateCollape);
    collapsezone!.classList.toggle("uncollapsed", forceStateCollape);
  }

  getPageInfo() {
    const modalRef = this.modalService.open(InfoDialogComponent, {
      centered: true,
      scrollable: true,
    });
    modalRef.componentInstance.message = this.pageDescription;
  }

  rdm() {
    this.toastr.info("Clicked on home");
    /*
    // DANGEROUS AND CAN BE MALICIOUS
    console.log("Logging Local Storage");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log("key =" + key + " | value = " + value);
      }
    }*/
  }
}
