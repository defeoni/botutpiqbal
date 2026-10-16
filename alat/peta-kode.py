"""Build or query an isolated Graphify AST index with original source locations.

Use a Python interpreter where graphify is installed. No network or LLM is used.
  python alat/peta-kode.py
  python alat/peta-kode.py --query apiUtp --budget 1200
  python alat/peta-kode.py --node utp_utp_apiUtpListProjects --budget 1200
"""

import argparse
import hashlib
import json
import os
import re
from collections import Counter
from pathlib import Path


EXCLUDED = {".git", ".venv", "node_modules", ".local", ".codex", ".agents",
            ".clasp-src", "graphify-out", "pratinjau", "arsip", "__pycache__"}
SUFFIXES = {".gs", ".js", ".html", ".py"}
SCRIPT = re.compile(r"<script\b([^>]*)>(.*?)</script\s*>", re.I | re.S)


def blank(value):
    return re.sub(r"[^\r\n]", " ", value)


def inline_javascript(source):
    """Keep script text at the original character/line offsets, blank all HTML."""
    result = list(blank(source))
    blocks = 0
    for match in SCRIPT.finditer(source):
        attributes = match.group(1)
        script_type = re.search(r"\btype\s*=\s*(['\"])(.*?)\1", attributes, re.I)
        if re.search(r"\bsrc\s*=", attributes, re.I):
            continue
        if script_type and script_type.group(2).lower() not in {
            "text/javascript", "application/javascript", "module", ""}:
            continue
        start, end = match.span(2)
        result[start:end] = match.group(2)
        blocks += 1
    javascript = "".join(result)
    # Apps Script HTML template tags are not JavaScript expressions.
    javascript = re.sub(r"<\?.*?\?>", lambda match: blank(match.group(0)), javascript, flags=re.S)
    return javascript, blocks


def source_files(root):
    files = []
    for directory, folders, names in os.walk(root):
        folders[:] = sorted(name for name in folders if name not in EXCLUDED and not name.startswith("."))
        for name in sorted(names):
            path = Path(directory) / name
            if path.suffix.lower() in SUFFIXES and not name.startswith("."):
                files.append(path)
    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def build(root):
    from graphify.extract import extract

    stage = root / ".local" / "code-graph-source"
    stage.mkdir(parents=True, exist_ok=True)
    mappings, manifest, staged = {}, [], []
    for source in source_files(root):
        relative = source.relative_to(root).as_posix()
        raw = source.read_bytes()
        content = raw.decode("utf-8-sig")
        entry = {"path": relative, "sha256": hashlib.sha256(raw).hexdigest(),
                 "lines": len(content.splitlines()), "scriptBlocks": None}
        if source.suffix.lower() == ".html":
            content, blocks = inline_javascript(content)
            entry["scriptBlocks"] = blocks
            if not blocks or not content.strip():
                entry["indexed"] = False
                manifest.append(entry)
                continue
        transformed = relative + ".js" if source.suffix.lower() in {".gs", ".html"} else relative
        destination = stage / transformed
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding="utf-8", newline="")
        mappings[transformed] = relative
        mappings[str(destination)] = relative
        entry["indexed"] = True
        manifest.append(entry)
        staged.append(destination)

    result = extract(staged, cache_root=stage, root=stage, parallel=False)
    failures = result.get("failed_sources", [])
    if failures:
        raise RuntimeError(f"Graphify failed to extract {len(failures)} source(s); existing index was retained")

    def original(value):
        return mappings.get(str(value), mappings.get(str(value).replace("\\", "/"), str(value)))

    nodes = result.get("nodes", [])
    edges = result.get("edges", [])
    for node in nodes:
        transformed = node.get("source_file", "")
        node["source_file"] = original(transformed)
        if node.get("label") == Path(transformed).name:
            node["label"] = Path(node["source_file"]).name
    for edge in edges:
        if "source_file" in edge:
            edge["source_file"] = original(edge["source_file"])
    node_ids = {node["id"] for node in nodes}
    # Graphify emits imports/builtin calls whose implementation is outside this
    # corpus. Retain their observed edges, marking endpoints as unresolved refs.
    unresolved = set()
    for edge in edges:
        for key in ("source", "target"):
            endpoint = edge.get(key)
            if not endpoint:
                raise RuntimeError("Graphify emitted an edge without an endpoint")
            if endpoint not in node_ids:
                unresolved.add(endpoint)
    for endpoint in sorted(unresolved):
        nodes.append({"id": endpoint, "label": f"Unresolved: {endpoint}",
                      "file_type": "external_reference", "source_file": "",
                      "source_location": "", "referenceOnly": True,
                      "_origin": "observed_ast_edge_endpoint"})
    graph = {
        "schemaVersion": 1,
        "engine": "graphify.extract AST",
        "directed": True,
        "input_tokens": result.get("input_tokens", 0),
        "output_tokens": result.get("output_tokens", 0),
        "sourceFiles": manifest,
        "excludedDirectories": sorted(EXCLUDED),
        "unresolvedReferenceCount": len(unresolved),
        "limits": [
            "Static AST index: runtime behavior, authorization, and deployment are not verified.",
            "Dynamic Apps Script includes and google.script.run RPCs may have no resolved edge.",
            "HTML script bodies retain original line offsets; markup and template tags are blanked.",
            "Existing graphify-out/graph.json remains a separate semantic graph.",
            "Unresolved reference nodes retain observed import/call endpoints without claiming their implementation is in this repository.",
        ],
        "nodes": sorted(nodes, key=lambda node: node["id"]),
        "edges": sorted(edges, key=lambda edge: (edge["source"], edge["target"], edge.get("relation", ""), edge.get("source_location", ""))),
    }
    output = root / "graphify-out"
    output.mkdir(exist_ok=True)
    (output / "code-graph.json").write_text(json.dumps(graph, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = Counter(node["source_file"] for node in nodes)
    lines = ["# Code source map", "", "Generated by `alat/peta-kode.py` using local Graphify AST extraction.",
             "", f"{len(nodes)} nodes, {len(edges)} edges. Extraction LLM tokens: 0 input, 0 output.", "",
             "`.gs` is parsed as JavaScript. Inline HTML scripts retain their original line numbers.",
             "The existing `graph.json` is preserved. This index does not establish runtime or cloud readiness.", "",
             "## Query", "", "```powershell", "python alat/peta-kode.py --query apiUtp --budget 1200",
             "python alat/peta-kode.py --node EXACT_NODE_ID --budget 1200", "```", "",
             "The budget is an approximate token cap enforced as four characters per token.",
             "Query results include matching node IDs and neighboring edges. Verify behavior in source.", "",
             "## Files", "", "| Source | Lines | AST nodes | Treatment |", "| --- | ---: | ---: | --- |"]
    for entry in manifest:
        path = entry["path"]
        treatment = "AST" if entry["indexed"] else "HTML/template wrapper without static inline JavaScript"
        lines.append(f"| [{path}](../{path.replace(' ', '%20')}) | {entry['lines']} | {counts[path]} | {treatment} |")
    lines += ["", "## Definitions", "", "| Symbol | Source | Line | Node ID |", "| --- | --- | ---: | --- |"]
    for node in graph["nodes"]:
        if not node.get("_callable") and not str(node.get("label", "")).endswith("()"):
            continue
        line_match = re.search(r"L(\d+)", node.get("source_location", ""))
        line = line_match.group(1) if line_match else ""
        path = node["source_file"]
        label = node.get("label", "").replace("|", "\\|")
        lines.append(f"| {label} | [{path}](../{path.replace(' ', '%20')}#L{line}) | {line} | `{node['id']}` |")
    lines += ["", "## Limits", ""] + [f"- {limit}" for limit in graph["limits"]]
    (output / "SOURCE_MAP.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(manifest), "indexedFiles": sum(entry["indexed"] for entry in manifest),
                      "nodes": len(nodes), "edges": len(edges), "unresolvedReferences": len(unresolved),
                      "inputTokens": graph["input_tokens"], "outputTokens": graph["output_tokens"]}))


def lookup(root, query, node_id, budget):
    graph = json.loads((root / "graphify-out" / "code-graph.json").read_text(encoding="utf-8"))
    needle = query.casefold()
    matches = [node for node in graph["nodes"] if (node["id"] == node_id if node_id else
               needle in (node.get("label", "") + " " + node.get("source_file", "") + " " + node["id"]).casefold())]
    selected = {node["id"] for node in matches}
    neighbors = [edge for edge in graph["edges"] if edge["source"] in selected or edge["target"] in selected]
    header = f"{len(matches)} matching nodes, {len(neighbors)} adjacent edges; budget ~{budget} tokens.\n"
    candidates = [header]
    candidates += [f"NODE {node['id']} | {node.get('label', '')} | {node.get('source_file', '')}:{node.get('source_location', '')}\n" for node in matches]
    candidates += [f"EDGE {edge['source']} --{edge.get('relation', '')}--> {edge['target']} | {edge.get('confidence', '')} | {edge.get('source_file', '')}:{edge.get('source_location', '')}\n" for edge in neighbors]
    remaining = budget * 4
    output = []
    for line in candidates:
        if len(line) + 24 > remaining:
            output.append("[budget limit reached]\n")
            break
        output.append(line)
        remaining -= len(line)
    print("".join(output), end="")


def self_test():
    source = '<h1>Example</h1>\n<script>\nfunction alpha() { return 1; }\n</script>\n<script type="application/json">{"x":1}</script>\n'
    transformed, blocks = inline_javascript(source)
    assert blocks == 1
    assert source.count("\n") == transformed.count("\n")
    assert transformed.splitlines()[2] == "function alpha() { return 1; }"
    assert "<h1>" not in transformed and '"x"' not in transformed
    templated, _ = inline_javascript('<script>\n<?!= include("X"); ?>\nfunction beta() {}\n</script>')
    assert "<?" not in templated and templated.splitlines()[2] == "function beta() {}"
    print("PASS: inline script offsets, non-JavaScript exclusion, template tag blanking")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", default="")
    parser.add_argument("--node", default="")
    parser.add_argument("--budget", type=int, default=1200)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.budget < 100:
        parser.error("budget must be at least 100")
    root = Path(__file__).resolve().parents[1]
    if args.self_test:
        self_test()
    elif args.query or args.node:
        lookup(root, args.query, args.node, args.budget)
    else:
        build(root)


if __name__ == "__main__":
    main()
