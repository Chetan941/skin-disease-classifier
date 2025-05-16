import torch
import torch.nn as nn
from torchvision import transforms
import timm
from PIL import Image
import gradio as gr
import numpy as np
import os

# === Configuration ===
classes = [
    'Acne', 'Benign_tumors', 'Eczema', 'Infestations_Bites', 'Lichen',
    'Psoriasis', 'Seborrh_Keratoses', 'Vitiligo', 'Warts'
]
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = timm.create_model("efficientnet_b3", pretrained=False, num_classes=len(classes))
model.load_state_dict(torch.load("models/efficientnet_b3_epoch_10.pth", map_location=device))
model = model.to(device)
model.eval()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# === Symptom Heuristic Boosts for each class ===
symptom_weights = {
    "itching": np.array([0.1, 0.0, 0.3, 0.2, 0.3, 0.1, 0.0, 0.0, 0.0]),
    "bleeding": np.array([0.0, 0.2, 0.0, 0.2, 0.1, 0.3, 0.2, 0.0, 0.0]),
    "scaly_skin": np.array([0.0, 0.0, 0.2, 0.0, 0.2, 0.4, 0.1, 0.0, 0.0]),
    "white_patches": np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0]),
    "sudden_onset": np.array([0.1, 0.2, 0.0, 0.3, 0.1, 0.1, 0.0, 0.0, 0.2]),
}

def predict_with_symptoms(image, itching, bleeding, scaly_skin, white_patches, sudden_onset):
    image = image.convert("RGB")
    img_tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(img_tensor)
        probs = torch.nn.functional.softmax(outputs, dim=1).cpu().numpy()[0]

    # Create weighted symptom vector
    symptom_vector = (
        symptom_weights["itching"] * int(itching) +
        symptom_weights["bleeding"] * int(bleeding) +
        symptom_weights["scaly_skin"] * int(scaly_skin) +
        symptom_weights["white_patches"] * int(white_patches) +
        symptom_weights["sudden_onset"] * int(sudden_onset)
    )

    # Blend model prediction and symptom bias
    adjusted_probs = probs + 0.2 * symptom_vector
    adjusted_probs /= adjusted_probs.sum()

    return {classes[i]: float(adjusted_probs[i]) for i in range(len(classes))}

# === Gradio App ===
interface = gr.Interface(
    fn=predict_with_symptoms,
    inputs=[
        gr.Image(type="pil", label="Upload Skin Image"),
        gr.Checkbox(label="Do you experience itching?"),
        gr.Checkbox(label="Is there bleeding or oozing?"),
        gr.Checkbox(label="Is your skin scaly or flaky?"),
        gr.Checkbox(label="Are there white patches?"),
        gr.Checkbox(label="Did this condition appear suddenly?")
    ],
    outputs=gr.Label(num_top_classes=3),
    title="AI Skin Disease Classifier with Symptom Questions",
    description="Upload a skin image and answer a few questions to improve prediction accuracy. This model does not require retraining.",
)

if __name__ == "__main__":
    interface.launch()