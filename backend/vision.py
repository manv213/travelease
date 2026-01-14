from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import base64
import io

app = Flask(__name__)
CORS(app)

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

LABELS = [
    "mountain", "beach", "city", "forest", "monument",
    "museum", "nature", "scenic view", "historic place",
    "urban street", "waterfall", "park"
]

@app.route("/api/vision", methods=["POST"])
def analyze_image():
    data = request.get_json()

    # ✅ FIXED KEY NAME
    image_base64 = data.get("image")

    if not image_base64:
        return jsonify({"error": "No image provided"}), 400

    image_bytes = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    inputs = processor(
        text=LABELS,
        images=image,
        return_tensors="pt",
        padding=True
    )

    outputs = model(**inputs)
    probs = outputs.logits_per_image.softmax(dim=1)[0]

    scored = sorted(
        zip(LABELS, probs.tolist()),
        key=lambda x: x[1],
        reverse=True
    )

    top_labels = [label for label, _ in scored[:3]]

    return jsonify({
        "vibe_tags": top_labels,
        "search_keywords": top_labels,
        "trip_summary": f"A trip inspired by {', '.join(top_labels)} environments."
    })

if __name__ == "__main__":
    app.run(port=5001, debug=True)
