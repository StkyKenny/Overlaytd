import { Component, OnInit } from "@angular/core";
import { ApiService } from "../api.service";
import { CommonModule } from "@angular/common";
import { FormsModule, NgForm } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { ToastrService } from "ngx-toastr";
import { LoginHandlerService } from "./login.handler.service";
import { SharedModule } from "../shared.module";
import { take } from "rxjs";
import { PageInfoService } from "../page-info.service";
import { PAGE_DESCRIPTIONS } from "../shared/page-descriptions";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-login",
  imports: [SharedModule], //CommonModule required for ngFor
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css",
})
export class LoginComponent implements OnInit {
  username: string = "visitor"; // Linked to [(ngModel)]
  password: string = "password";

  staticCheck: boolean = environment.production;
  randomOffsets: number[][] = [];
  tex =
    "This version is a preview, backend's logics are missing\nsuch as login and server-related actions\nBut it can still save onto your browser for serverless usage\nCheck left navigation to explore";
  lines = this.tex.split("\n");

  constructor(
    private service: ApiService,
    private loginHandler: LoginHandlerService,
    private toastr: ToastrService,
    private pageInfoService: PageInfoService,
  ) {}
  ngOnInit() {
    this.pageInfoService.updateInformation(PAGE_DESCRIPTIONS.login);

    this.randomOffsets = this.tex.split("\n").map((line, j) => line.split("").map((char, i) => Math.random() * 0.75));
  }

  ngAfterViewInit() {}

  loginWithGithub() {
    window.location.href = environment.APIBaseUrl + "oauth2/authorization/github";
  }
  loginWithGoogle() {
    window.location.href = environment.APIBaseUrl + "oauth2/authorization/google";
  }

  doLogin(form: NgForm) {
    // NgForm to fetch value from ngModel
    let a = this.service.login(this.username, this.password);
    a.pipe(take(1)).subscribe({
      next: (response: any) => {
        this.loginHandler.handle();
      },
      error: (err) => {
        console.error("Login failed:", err);
        this.toastr.error("", "Login failed");
      },
    });
  }
}
