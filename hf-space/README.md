---
title: Pickleball Motion Analyzer API
emoji: 🏓
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Pickleball Motion Analyzer API

FastAPI backend for the Pickleball Motion Analyzer frontend.

Endpoints:

- `GET /api/health`
- `POST /api/analyze`
- `GET /outputs/{job_id}/{filename}`

The frontend should set:

```text
PMA_API_BASE=https://YOUR_USERNAME-pickleball-motion-analyzer-api.hf.space
```

Free Spaces can sleep and may be slow for video processing. Use short videos for testing.
