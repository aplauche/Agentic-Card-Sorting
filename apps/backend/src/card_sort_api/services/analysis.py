import difflib
import json
import re

import numpy as np
from scipy.cluster.hierarchy import linkage, dendrogram, fcluster
from scipy.spatial.distance import squareform
import plotly.graph_objects as go
from plotly.subplots import make_subplots


# --- Data loading & normalization ---

def normalize_label(label: str) -> str:
    """Normalize a label for fuzzy matching against canonical labels."""
    s = label.strip()
    s = re.sub(r"[\t\x00-\x1f]", "", s)
    s = re.sub(r"[^\x20-\x7e]", "", s)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\bf[0-9a-f]{1,2}\b", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.lower()


def build_label_index(canonical_labels: list[str]) -> dict[str, int]:
    index = {}
    for i, label in enumerate(canonical_labels):
        index[normalize_label(label)] = i
    return index


def match_label(raw_label: str, label_index: dict[str, int]) -> int | None:
    norm = normalize_label(raw_label)
    if norm in label_index:
        return label_index[norm]

    canonical_norms = list(label_index.keys())
    matches = difflib.get_close_matches(norm, canonical_norms, n=1, cutoff=0.75)
    if matches:
        return label_index[matches[0]]

    return None


def build_similarity_matrix(summary: dict) -> tuple[list[str], np.ndarray]:
    """Build similarity matrix from summary JSON data.

    Extracts canonical labels from the first agent's results and computes
    co-occurrence across all agents.
    """
    results = summary["results"]
    n_agents = len(results)

    # Extract canonical labels from all agents' results (union of all labels)
    all_labels: list[str] = []
    seen: set[str] = set()
    for result in results:
        for bin_data in result["bins"]:
            for label in bin_data["labels"]:
                norm = normalize_label(label)
                if norm not in seen:
                    seen.add(norm)
                    all_labels.append(label)

    n_labels = len(all_labels)
    label_index = build_label_index(all_labels)

    cooccurrence = np.zeros((n_labels, n_labels), dtype=np.float64)

    for result in results:
        label_to_bin: dict[int, int] = {}
        bins_labels: list[list[int]] = []

        for bin_idx, bin_data in enumerate(result["bins"]):
            bin_label_indices = []
            for raw_label in bin_data["labels"]:
                matched = match_label(raw_label, label_index)
                if matched is None:
                    continue
                if matched in label_to_bin:
                    continue
                label_to_bin[matched] = bin_idx
                bin_label_indices.append(matched)
            bins_labels.append(bin_label_indices)

        for bin_indices in bins_labels:
            for i in range(len(bin_indices)):
                for j in range(i + 1, len(bin_indices)):
                    a, b = bin_indices[i], bin_indices[j]
                    cooccurrence[a][b] += 1
                    cooccurrence[b][a] += 1

    similarity = cooccurrence / n_agents
    np.fill_diagonal(similarity, 1.0)

    return all_labels, similarity


# --- HCA ---

def run_hca(similarity: np.ndarray, method: str = "ward"):
    distance = 1 - similarity
    distance = np.clip(distance, 0, None)
    condensed = squareform(distance, checks=False)
    Z = linkage(condensed, method=method)
    dendro = dendrogram(Z, no_plot=True, color_threshold=0.7 * max(Z[:, 2]))
    return Z, dendro


# --- Visualization ---

MPL_COLORS = {
    "C0": "#1f77b4", "C1": "#ff7f0e", "C2": "#2ca02c", "C3": "#d62728",
    "C4": "#9467bd", "C5": "#8c564b", "C6": "#e377c2", "C7": "#7f7f7f",
    "C8": "#bcbd22", "C9": "#17becf",
}


def convert_dendro_color(color: str) -> str:
    return MPL_COLORS.get(color, color)


def truncate_label(label: str, max_len: int = 40) -> str:
    return label if len(label) <= max_len else label[: max_len - 1] + "\u2026"


def build_dendrogram_figure(
    canonical_labels: list[str],
    dendro: dict,
) -> dict:
    """Build a Plotly dendrogram figure and return as JSON-serializable dict."""
    leaf_order = dendro["leaves"]
    n = len(canonical_labels)
    ordered_labels = [canonical_labels[i] for i in leaf_order]
    short_labels = [truncate_label(l) for l in ordered_labels]

    icoord = np.array(dendro["icoord"])
    dcoord = np.array(dendro["dcoord"])
    colors = dendro["color_list"]

    fig = go.Figure()

    for i in range(len(icoord)):
        fig.add_trace(
            go.Scatter(
                x=icoord[i].tolist(),
                y=dcoord[i].tolist(),
                mode="lines",
                line=dict(color=convert_dendro_color(colors[i]), width=1.5),
                hoverinfo="skip",
                showlegend=False,
            )
        )

    dendro_x = [5 + 10 * k for k in range(n)]

    fig.update_xaxes(
        tickvals=dendro_x,
        ticktext=short_labels,
        tickangle=90,
        tickfont=dict(size=9),
    )
    fig.update_yaxes(title_text="Distance")
    fig.update_layout(
        title="Dendrogram",
        height=400,
        template="plotly_white",
        margin=dict(b=200),
    )

    return json.loads(fig.to_json())


def build_heatmap_figure(
    canonical_labels: list[str],
    similarity: np.ndarray,
    dendro: dict,
) -> dict:
    """Build a Plotly heatmap figure and return as JSON-serializable dict."""
    leaf_order = dendro["leaves"]
    n = len(canonical_labels)
    ordered_labels = [canonical_labels[i] for i in leaf_order]
    short_labels = [truncate_label(l) for l in ordered_labels]
    reordered_sim = similarity[np.ix_(leaf_order, leaf_order)]

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

    dendro_x = [5 + 10 * k for k in range(n)]

    fig = go.Figure()
    fig.add_trace(
        go.Heatmap(
            z=reordered_sim.tolist(),
            x=dendro_x,
            y=dendro_x,
            colorscale="Blues",
            zmin=0,
            zmax=1,
            text=hover_text,
            hovertemplate="%{text}<extra></extra>",
            colorbar=dict(title="Similarity"),
        )
    )

    fig.update_xaxes(
        tickvals=dendro_x,
        ticktext=short_labels,
        tickangle=90,
        tickfont=dict(size=9),
    )
    fig.update_yaxes(
        tickvals=dendro_x,
        ticktext=short_labels,
        tickfont=dict(size=9),
        autorange="reversed",
    )
    fig.update_layout(
        title="Similarity Matrix",
        height=800,
        width=900,
        template="plotly_white",
        margin=dict(b=200, l=200),
    )

    return json.loads(fig.to_json())


def build_cluster_data(
    canonical_labels: list[str],
    Z: np.ndarray,
    n_clusters: int,
) -> list[dict]:
    """Return cluster assignments as structured data."""
    clusters = fcluster(Z, t=n_clusters, criterion="maxclust")

    cluster_groups: dict[int, list[str]] = {}
    for label, cluster_id in zip(canonical_labels, clusters):
        cluster_groups.setdefault(int(cluster_id), []).append(label)

    sorted_clusters = sorted(cluster_groups.items(), key=lambda x: -len(x[1]))

    return [
        {"cluster_id": i, "labels": labels, "size": len(labels)}
        for i, (_cid, labels) in enumerate(sorted_clusters, 1)
    ]


def analyze(summary: dict, k: int = 8, linkage_method: str = "ward") -> dict:
    """Run full analysis pipeline and return results as a dict."""
    canonical_labels, similarity = build_similarity_matrix(summary)
    Z, dendro = run_hca(similarity, method=linkage_method)

    return {
        "dendrogram": build_dendrogram_figure(canonical_labels, dendro),
        "heatmap": build_heatmap_figure(canonical_labels, similarity, dendro),
        "clusters": build_cluster_data(canonical_labels, Z, n_clusters=k),
    }
