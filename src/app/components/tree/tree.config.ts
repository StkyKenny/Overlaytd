import * as d3 from "d3";
import { Astre } from "src/app/models/Astre";
export const tooltipConfig = {
  font: {
    size: 24,
  },
  comment: {
    font: {
      size: 14,
    },
  },
};
export const buttonConfig = {
  width: "2em",
  height: "2em",
};

export const linkConfig = {
  stroke: {
    width: 3,
    widthHover: 8,
    rainbowLoop: true,
    saturation: 1,
    luminosity: 0.5,
  },
};
export const treeConfig = {
  label: {
    defaultOpacity: 0.5,
    hoverOpacity: 1,
    defaultWeight: 300,
    hightlightedWeight: 900,
    hoverWeight: 700,
  },
};
export function rainbowLoop(elem: any, attributeName: string, link: d3.HierarchyPointLink<Astre>) {
  let saturationVarianceMax = 0.9;
  let saturationVarianceMin = 0.2;
  let luminosityVarianceMax = 0.8;
  let luminosityVarianceMin = 0.2;

  let i = 0;
  let step = 20;
  const colors = [...Array(Math.floor(361 / step) + 1).keys()].map((i) => i * step);

  // Reset to default
  linkConfig.stroke.saturation = 1;
  linkConfig.stroke.luminosity = 0.5;
  let linkOriginalColor = elem.attr(attributeName);

  function next(elem: any, attributeName: string) {
    if (linkConfig.stroke.rainbowLoop)
      elem
        .transition()
        .attr(
          attributeName,
          d3.hsl(colors[i], linkConfig.stroke.saturation, linkConfig.stroke.luminosity, 1).clamp().formatHsl(),
        )
        .on("end", () => {
          i = (i + 1) % colors.length;
          if (i == colors.length - 1) {
            linkConfig.stroke.saturation =
              Math.random() * (saturationVarianceMax - saturationVarianceMin) + saturationVarianceMin;
            linkConfig.stroke.luminosity =
              Math.random() * (luminosityVarianceMax - luminosityVarianceMin) + luminosityVarianceMin;
          }
          elem.interrupt();
          if (!linkConfig.stroke.rainbowLoop) {
            // Because of event loop, I still need to reset here
            elem.transition().attr(attributeName, linkOriginalColor).attr("stroke-width", linkConfig.stroke.width);
          } else {
            next(elem, attributeName);
          }
        });
  }
  next(elem, attributeName);
}
