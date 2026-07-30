"""
CLIP model utilities — image and text encoding via openai/clip-vit-base-patch32.

Uses the ``transformers`` library (already installed as a sentence-transformers
dependency) so no new heavy pip package is needed.

Models are loaded once at import time (module-level singletons) because
initialisation takes several seconds.  Both the Celery worker and the FastAPI
process import this module, so each process gets its own independent copy in
memory.

CLIP ViT-B/32 output dimensionality: **512**.
"""
import logging
from typing import List

import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy-loaded singletons (loaded on first use, not at import time, so that
# importing this module doesn't block startup when CLIP isn't needed).
# ---------------------------------------------------------------------------
_model = None
_processor = None


def _load():
    global _model, _processor
    if _model is not None:
        return
    from transformers import CLIPModel, CLIPProcessor

    model_id = "openai/clip-vit-base-patch32"
    logger.info("Loading CLIP model %s …", model_id)
    _processor = CLIPProcessor.from_pretrained(model_id)
    _model = CLIPModel.from_pretrained(model_id)
    _model.eval()
    logger.info("CLIP model loaded (dim=%d)", embedding_dim())


def embedding_dim() -> int:
    """Return the output dimensionality of the CLIP model (512 for ViT-B/32)."""
    return 512


# ---------------------------------------------------------------------------
# Image encoding
# ---------------------------------------------------------------------------

def encode_images(image_paths: List[str], batch_size: int = 8) -> np.ndarray:
    """Encode a list of local image files into CLIP embeddings.

    Returns an ``(N, 512)`` float32 array, L2-normalized per row.
    Images that fail to load are skipped (resulting array may be shorter).
    """
    _load()

    embeddings: List[np.ndarray] = []
    for start in range(0, len(image_paths), batch_size):
        batch_paths = image_paths[start : start + batch_size]
        images = []
        for p in batch_paths:
            try:
                images.append(Image.open(p).convert("RGB"))
            except Exception:
                logger.warning("Could not load image %s — skipping", p)

        if not images:
            continue

        inputs = _processor(images=images, return_tensors="pt", padding=True)
        with torch.no_grad():
            outputs = _model.get_image_features(**inputs)
        features = outputs.image_embeds if not isinstance(outputs, torch.Tensor) else outputs

        # L2-normalize each row
        features = features / features.norm(dim=-1, keepdim=True)
        embeddings.append(features.cpu().numpy().astype(np.float32))

    if not embeddings:
        return np.zeros((0, embedding_dim()), dtype=np.float32)

    return np.concatenate(embeddings, axis=0)


# ---------------------------------------------------------------------------
# Text encoding
# ---------------------------------------------------------------------------

def encode_text(text: str) -> np.ndarray:
    """Encode a text string into a CLIP embedding.

    Returns a ``(512,)`` float32 vector, L2-normalized.
    """
    _load()

    inputs = _processor(text=[text], return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
        outputs = _model.get_text_features(**inputs)
    features = outputs.text_embeds if not isinstance(outputs, torch.Tensor) else outputs

    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy().astype(np.float32).flatten()
