import { Injectable, Signal, signal } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class TreeService {
  constructor() {}

  tooltipPinned = signal(false);

  setTooltipPin(flag: boolean) {
    this.tooltipPinned.set(flag);
  }
  getTooltipPin() {
    return this.tooltipPinned();
  }
}
