"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";

import type { GraphLink, GraphNode } from "@/shared/lib/graph";

type GraphViewProps = {
  nodes: GraphNode[];
  links: GraphLink[];
};

type SimNode = GraphNode & d3.SimulationNodeDatum;

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  source: string | SimNode;
  target: string | SimNode;
};

const WIDTH = 900;
const HEIGHT = 520;

export const GraphView = ({ nodes, links }: GraphViewProps): JSX.Element => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const router = useRouter();

  const data = useMemo(() => {
    const simNodes: SimNode[] = nodes.map((node) => ({ ...node }));
    const simLinks: SimLink[] = links.map((link) => ({
      source: link.source,
      target: link.target,
    }));
    return { simNodes, simLinks };
  }, [nodes, links]);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

    const link = svg
      .append("g")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.7)
      .selectAll("line")
      .data(data.simLinks)
      .join("line")
      .attr("stroke-width", 1.5);

    const node = svg
      .append("g")
      .selectAll("g")
      .data(data.simNodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_event: unknown, d: SimNode) => {
        router.push(`/notes/${d.id}`);
      });

    node.append("circle").attr("r", 7).attr("fill", "#2563eb");

    node
      .append("text")
      .text((d: SimNode) => d.title)
      .attr("x", 10)
      .attr("y", 4)
      .style("font-size", "12px")
      .style("fill", "#0f172a");

    const simulation = d3
      .forceSimulation(data.simNodes)
      .force(
        "link",
        d3.forceLink<SimNode, SimLink>(data.simLinks).id((d: SimNode) => d.id),
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2));

    const resolveNode = (value: string | SimNode): SimNode | null =>
      typeof value === "string" ? null : value;

    const resolveX = (value: string | SimNode): number => resolveNode(value)?.x ?? 0;

    const resolveY = (value: string | SimNode): number => resolveNode(value)?.y ?? 0;

    simulation.on("tick", () => {
      link
        .attr("x1", (d: SimLink) => resolveX(d.source))
        .attr("y1", (d: SimLink) => resolveY(d.source))
        .attr("x2", (d: SimLink) => resolveX(d.target))
        .attr("y2", (d: SimLink) => resolveY(d.target));

      node.attr("transform", (d: SimNode) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, router]);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px" }}>
      <svg ref={svgRef} width="100%" height={HEIGHT} />
    </div>
  );
};
