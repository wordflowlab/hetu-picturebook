export const config = {
  "fields": {
    "page": "pages",
    "note": "notes"
  },
  "defaults": {
    "pages": [],
    "notes": [],
    "format": {
      "width_mm": 180,
      "height_mm": 180,
      "bleed_mm": 3,
      "safe_mm": 8,
      "direction": "ltr",
      "binding": "digital",
      "target_dpi": 150
    }
  },
  "tabs": [
    "跨页阅读",
    "图文与翻页",
    "版面检查",
    "局部意见",
    "接续创作"
  ]
} as const;
