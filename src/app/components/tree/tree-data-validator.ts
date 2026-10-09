import { ToastrService } from "ngx-toastr";
import { Astre } from "src/app/models/Astre";

/**
 * Check if the data is valid for making a tree hierarchy
 * It checks for multiple roots and cycle in graph
 *
 * @returns True if the Data is valid, false otherwise
 */
export function isValidData(astres: Astre[], toastr: ToastrService): boolean {
  let roots = astres.filter((a) => a.parent == null || a.parent == "");
  if (roots.length > 1) {
    toastr.info(
      Array.from(roots)
        .map((a) => a.astreID.name)
        .join(" | "),
      "Invalid (Multiple roots found)",
      { disableTimeOut: true },
    );
    return false;
  }

  let visited: Set<Astre> = new Set(); // For cehcking cycle
  astres.forEach((a) => {
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
        toastr.info(
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
      currentNode = astres.filter((a) => a.astreID.name == currentParent)[0];
    }
    visited = new Set<Astre>([...visited, ...visitedLocal]);
  });
  return true;
}
