import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { Astre, AstreID, astreIDKey } from "./models/Astre";
import { AstreChildren, AstreLinksResponse } from "./models/AstreResponse";
import { BehaviorSubject, map, Observable, take } from "rxjs";
import { Router } from "@angular/router";
import { ToastrService } from "ngx-toastr";
import { environment } from "src/environments/environment";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  isLogged = false;
  loginData = { username: "", password: "" };

  private loggedWithOauth = new BehaviorSubject<boolean>(false);

  // Observable for other components to subscribe to
  readonly isLoggedIn$: Observable<boolean> = this.loggedWithOauth.asObservable();

  astres: Map<string, Astre> = new Map();
  childrenMap: Map<string, AstreID[]> = new Map(); // key as string because key works as reference when using object

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  getCsrfToken() {
    return this.http
      .get(environment.APIBaseUrl + "csrf/token", { withCredentials: true })
      .subscribe((data: any) => localStorage.setItem("csrf", data.token));
  }
  isOauth() {
    return this.loggedWithOauth.getValue();
  }

  public logged() {
    this.loggedWithOauth.next(true);
    return true;
  }

  public login(usernameInput: string, passwordInput: string) {
    return this.http.post(
      environment.APIBaseUrl + "auth/login2",
      {
        username: usernameInput,
        password: passwordInput,
      },
      {
        headers: {
          "access-control-allow-origin": "http://localhost:4200/",
          withCredentials: "true",
          "Content-Type": "application/json",
          accept: "application/hal+json",
        },
        responseType: "json",
      },
    ); //.pipe( () => );
  }

  public refresh() {
    return this.http.post(
      environment.APIBaseUrl + "auth/refresh",
      {},
      {
        withCredentials: true,
        responseType: "json",
      },
    );
  }

  /*this.http.post<string>(environment.APIBaseUrl + "login", body, {
      headers,
      //withCredentials: true,// cross-site Access-Control requests should be made using credentials such as cookies, authentication headers or TLS client certificates
      responseType: "json",
    });*/

  public logout() {
    //this.loggedInSubject.next(false);

    console.log("in logout service");
    this.http
      .post(environment.APIBaseUrl + "auth/logout", {}, { withCredentials: true })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.router
            .navigate(["/login"])
            .then(() => this.toastr.success("Please Login to access the app", "Logout Successful"));
          this.loggedWithOauth.next(false);
        },
        error: (err) => {
          console.log(err);
          this.toastr.error(err, "Observable Error logging out");
        },
      });
    console.log("Getting after post logout");
  }

  getAstres(): Observable<Astre[]> {
    const headers = new HttpHeaders({});
    let request = this.http.get<Astre[]>(environment.APIBaseUrl + "api/astres/getall", {});
    return request;
  }

  loadAstres(): Map<string, Astre> {
    return this.astres;
  }

  getAstresAndLinks(): Observable<Astre[]> {
    const headers = new HttpHeaders({});
    let request = this.http.get<AstreLinksResponse>(environment.APIBaseUrl + "api/astres/astreslinks", {});
    return request.pipe(
      map((response: AstreLinksResponse) => {
        response.astres.forEach((astre: Astre) => {
          this.astres.set(astreIDKey(astre.astreID), astre);
        });
        response.childrenList.forEach((link: AstreChildren) => {
          if (link.id) {
            this.childrenMap.set(astreIDKey(link.id), link.children);
          }
        });
        return response.astres;
      }),
    );
  }

  getLocalAstres() {
    return this.http.get<Astre[]>(environment.exampleDataPath);
  }

  getChildren() {
    if (this.childrenMap.size < 1) {
      this.getAstresAndLinks().pipe(take(1)).subscribe();
    }
    return this.childrenMap;
  }

  postAstres(astres: Astre[]) {
    const headers = new HttpHeaders({});

    astres.forEach((astre) => {
      (Object.keys(astre.astreID) as (keyof AstreID)[]).forEach((key) => {
        if (astre["astreID"][key] === null) {
          astre["astreID"][key] = "";
        }
      });
    });

    headers.set("access-control-allow-origin", "http://localhost:4200/");

    return this.http.post<Astre[]>(environment.APIBaseUrl + "api/astres/astres", astres);
  }
  deleteAstre(type: string, subtype: string, name: string): Observable<Astre[]> {
    const headers = new HttpHeaders({});
    const astreID: AstreID = { type, subtype, name };
    headers.set("access-control-allow-origin", "http://localhost:4200/");
    return this.http.delete<Astre[]>(environment.APIBaseUrl + "api/astres/astre", {
      headers,
      body: astreID,
    });
  }

  getUserDetails() {
    const headers = new HttpHeaders({});

    return this.http.get<Astre[]>(environment.APIBaseUrl + "auth/userDetails", {
      headers,
    });
  }

  addTagToAstre(astresIDs: Set<AstreID>) {}
}
