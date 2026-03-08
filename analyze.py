import argparse
import difflib
import json
import re
import sys
import webbrowser
from pathlib import Path

import numpy as np
from scipy.cluster.hierarchy import linkage, dendrogram, fcluster
from scipy.spatial.distance import squareform
import plotly.graph_objects as go
from plotly.subplots import make_subplots


# --- Data loading & normalization ---

def normalize_label(label: str) -> str:
    """Normalize a label for fuzzy matching against canonical labels."""
    s = label.strip()
    s = re.sub(r"[\t\x00-\x1f]", "", s)  # strip control chars
    # Strip non-ASCII entirely for matching (handles encoding corruption)
    s = re.sub(r"[^\x20-\x7e]", "", s)
    s = re.sub(r"\s+", " ", s)  # collapse whitespace
    # Remove stray hex-like artifacts (e.g. "f1ol" from corrupted "ñol")
    s = re.sub(r"\bf[0-9a-f]{1,2}\b", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.lower()


def build_label_index(canonical_labels: list[str]) -> dict[str, int]:
    """Build a mapping from normalized label -> index in the canonical list."""
    index = {}
    for i, label in enumerate(canonical_labels):
        index[normalize_label(label)] = i
    return index


def match_label(raw_label: str, label_index: dict[str, int]) -> int | None:
    """Match a raw agent label to a canonical label index."""
    norm = normalize_label(raw_label)
    if norm in label_index:
        return label_index[norm]

    # Fuzzy fallback: use difflib to find closest match
    canonical_norms = list(label_index.keys())
    matches = difflib.get_close_matches(norm, canonical_norms, n=1, cutoff=0.75)
    if matches:
        return label_index[matches[0]]

    return None


def load_data(summary_path: Path, labels_path: Path) -> tuple[list[str], np.ndarray]:
    """Load summary.json and labels.json, return canonical labels and similarity matrix."""
    canonical_labels = json.loads(labels_path.read_text())
    summary = json.loads(summary_path.read_text())
    results = summary["results"]
    n_labels = len(canonical_labels)
    n_agents = len(results)
    label_index = build_label_index(canonical_labels)

    # Co-occurrence matrix
    cooccurrence = np.zeros((n_labels, n_labels), dtype=np.float64)

    for result in results:
        agent_id = result["agent_id"]
        # Map each label to its bin for this agent
        label_to_bin: dict[int, int] = {}
        bins_labels: list[list[int]] = []

        for bin_idx, bin_data in enumerate(result["bins"]):
            bin_label_indices = []
            for raw_label in bin_data["labels"]:
                matched = match_label(raw_label, label_index)
                if matched is None:
                    print(f"  Warning: Agent {agent_id} label not matched: '{raw_label}'", file=sys.stderr)
                    continue
                if matched in label_to_bin:
                    # Duplicate — skip (already assigned to first bin)
                    continue
                label_to_bin[matched] = bin_idx
                bin_label_indices.append(matched)
            bins_labels.append(bin_label_indices)

        # Count co-occurrences: for each bin, all pairs of labels in that bin
        for bin_indices in bins_labels:
            for i in range(len(bin_indices)):
                for j in range(i + 1, len(bin_indices)):
                    a, b = bin_indices[i], bin_indices[j]
                    cooccurrence[a][b] += 1
                    cooccurrence[b][a] += 1

    # Normalize to 0-1
    similarity = cooccurrence / n_agents
    np.fill_diagonal(similarity, 1.0)

    return canonical_labels, similarity


# --- HCA ---

def run_hca(similarity: np.ndarray, method: str = "average"):
    """Run hierarchical cluster analysis, return linkage matrix and dendrogram data."""
    distance = 1 - similarity
    # Ensure no negative distances from floating point
    distance = np.clip(distance, 0, None)
    condensed = squareform(distance, checks=False)
    Z = linkage(condensed, method=method)
    dendro = dendrogram(Z, no_plot=True, color_threshold=0.7 * max(Z[:, 2]))
    return Z, dendro


# --- Visualization ---

# Matplotlib C0-C9 color cycle mapped to hex (scipy dendrogram uses these)
MPL_COLORS = {
    "C0": "#1f77b4", "C1": "#ff7f0e", "C2": "#2ca02c", "C3": "#d62728",
    "C4": "#9467bd", "C5": "#8c564b", "C6": "#e377c2", "C7": "#7f7f7f",
    "C8": "#bcbd22", "C9": "#17becf",
}


def convert_dendro_color(color: str) -> str:
    """Convert matplotlib color codes to CSS-compatible hex colors."""
    return MPL_COLORS.get(color, color)


def truncate_label(label: str, max_len: int = 40) -> str:
    return label if len(label) <= max_len else label[: max_len - 1] + "\u2026"


def build_figure(
    canonical_labels: list[str],
    similarity: np.ndarray,
    Z: np.ndarray,
    dendro: dict,
) -> go.Figure:
    """Build a Plotly figure with dendrogram + clustered heatmap."""
    leaf_order = dendro["leaves"]
    n = len(canonical_labels)

    # Reorder labels and matrix by dendrogram leaf order
    ordered_labels = [canonical_labels[i] for i in leaf_order]
    short_labels = [truncate_label(l) for l in ordered_labels]
    reordered_sim = similarity[np.ix_(leaf_order, leaf_order)]

    fig = make_subplots(
        rows=2, cols=1,
        row_heights=[0.25, 0.75],
        vertical_spacing=0.02,
        shared_xaxes=True,
    )

    # --- Dendrogram traces ---
    icoord = np.array(dendro["icoord"])
    dcoord = np.array(dendro["dcoord"])
    colors = dendro["color_list"]

    for i in range(len(icoord)):
        fig.add_trace(
            go.Scatter(
                x=icoord[i],
                y=dcoord[i],
                mode="lines",
                line=dict(color=convert_dendro_color(colors[i]), width=1.5),
                hoverinfo="skip",
                showlegend=False,
            ),
            row=1, col=1,
        )

    # --- Heatmap ---
    # Build hover text matrix
    hover_text = []
    for i in range(n):
        row_texts = []
        for j in range(n):
            row_texts.append(
                f"<b>{ordered_labels[i]}</b><br>"
                f"<b>{ordered_labels[j]}</b><br>"
                f"Similarity: {reordered_sim[i][j]:.2f}"
            )
        hover_text.append(row_texts)

    # Map heatmap positions to match dendrogram leaf spacing (scipy default: 5, 15, 25, ...)
    dendro_x = [5 + 10 * k for k in range(n)]

    fig.add_trace(
        go.Heatmap(
            z=reordered_sim,
            x=dendro_x,
            y=dendro_x,
            colorscale="Blues",
            zmin=0,
            zmax=1,
            text=hover_text,
            hovertemplate="%{text}<extra></extra>",
            colorbar=dict(title="Similarity", y=0.35, len=0.6),
        ),
        row=2, col=1,
    )

    # --- Layout ---
    fig.update_xaxes(
        tickvals=dendro_x,
        ticktext=short_labels,
        tickangle=90,
        tickfont=dict(size=9),
        row=2, col=1,
    )
    fig.update_yaxes(
        tickvals=dendro_x,
        ticktext=short_labels,
        tickfont=dict(size=9),
        autorange="reversed",
        row=2, col=1,
    )

    # Hide dendrogram axes ticks
    fig.update_xaxes(showticklabels=False, row=1, col=1)
    fig.update_yaxes(title_text="Distance", row=1, col=1)

    fig.update_layout(
        title="Open Card Sort Analysis — Dendrogram & Similarity Matrix",
        height=1200,
        width=1100,
        template="plotly_white",
        margin=dict(b=250, l=250),
    )

    return fig


def build_cluster_table_html(
    canonical_labels: list[str],
    Z: np.ndarray,
    threshold: float = 0.5,
) -> str:
    """Generate an HTML table of clusters cut at the given similarity threshold."""
    # fcluster uses distance threshold, so convert
    distance_threshold = 1 - threshold
    clusters = fcluster(Z, t=distance_threshold, criterion="distance")

    # Group labels by cluster
    cluster_groups: dict[int, list[str]] = {}
    for label, cluster_id in zip(canonical_labels, clusters):
        cluster_groups.setdefault(cluster_id, []).append(label)

    # Sort clusters by size descending
    sorted_clusters = sorted(cluster_groups.items(), key=lambda x: -len(x[1]))

    rows = []
    for i, (cluster_id, labels) in enumerate(sorted_clusters, 1):
        label_list = "".join(f"<li>{l}</li>" for l in labels)
        rows.append(
            f"<tr><td style='vertical-align:top;font-weight:bold;padding:8px;'>"
            f"Cluster {i}<br><span style='font-weight:normal;color:#666;'>"
            f"({len(labels)} labels)</span></td>"
            f"<td style='padding:8px;'><ul style='margin:0;padding-left:20px;'>"
            f"{label_list}</ul></td></tr>"
        )

    return f"""
    <div style="max-width:900px;margin:40px auto;font-family:system-ui,sans-serif;">
        <h2>Cluster Groups (similarity threshold: {threshold})</h2>
        <p style="color:#666;">Labels that were grouped together by at least
        {int(threshold * 100)}% of participants.</p>
        <table style="border-collapse:collapse;width:100%;">
            <thead><tr style="border-bottom:2px solid #333;">
                <th style="text-align:left;padding:8px;width:140px;">Cluster</th>
                <th style="text-align:left;padding:8px;">Labels</th>
            </tr></thead>
            <tbody>{"".join(rows)}</tbody>
        </table>
    </div>
    """


def save_html(fig: go.Figure, cluster_html: str, output_path: Path) -> None:
    """Save the Plotly figure + cluster table as a single HTML file."""
    plotly_html = fig.to_html(include_plotlyjs=True, full_html=False)

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Card Sort Analysis</title>
    <style>
        body {{ font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #fafafa; }}
        .chart-container {{ max-width: 1100px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
    </style>
</head>
<body>
    <div class="chart-container">
        {plotly_html}
    </div>
    {cluster_html}
</body>
</html>"""

    output_path.write_text(full_html)


# --- CLI ---

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze open card sort results: similarity matrix, HCA, and dendrograms."
    )
    parser.add_argument(
        "--input", type=str, default="output/summary.json",
        help="Path to summary.json (default: output/summary.json)",
    )
    parser.add_argument(
        "--labels", type=str, default="labels.json",
        help="Path to labels.json (default: labels.json)",
    )
    parser.add_argument(
        "--output", type=str, default="output/analysis.html",
        help="Output HTML file (default: output/analysis.html)",
    )
    parser.add_argument(
        "--linkage", type=str, default="average",
        choices=["average", "complete", "single", "ward"],
        help="Linkage method for HCA (default: average)",
    )
    parser.add_argument(
        "--threshold", type=float, default=0.5,
        help="Similarity threshold for cluster cutting (default: 0.5)",
    )
    parser.add_argument(
        "--no-open", action="store_true",
        help="Don't auto-open the HTML in browser",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    summary_path = Path(args.input)
    labels_path = Path(args.labels)
    output_path = Path(args.output)

    print("Loading data...")
    canonical_labels, similarity = load_data(summary_path, labels_path)
    print(f"  {len(canonical_labels)} labels, similarity matrix shape: {similarity.shape}")

    print(f"Running HCA (linkage={args.linkage})...")
    Z, dendro = run_hca(similarity, method=args.linkage)

    print("Building visualizations...")
    fig = build_figure(canonical_labels, similarity, Z, dendro)
    cluster_html = build_cluster_table_html(canonical_labels, Z, threshold=args.threshold)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    save_html(fig, cluster_html, output_path)
    print(f"Analysis saved to {output_path}")

    if not args.no_open:
        webbrowser.open(f"file://{output_path.resolve()}")


if __name__ == "__main__":
    main()
