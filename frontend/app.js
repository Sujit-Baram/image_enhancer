// Image Enhancer — frontend logic
// Every request goes to a RELATIVE path (/api/..., /enhanced/...) — Nginx,
// running inside this same container, reverse-proxies those to the
// "backend" service by NAME over the Docker Compose network. The browser
// never talks to the backend directly.

const form = document.getElementById("enhance-form");
const fileInput = document.getElementById("file-input");
const dropzoneLabel = document.getElementById("dropzone-label");
const widthInput = document.getElementById("width");
const brightnessInput = document.getElementById("brightness");
const brightnessVal = document.getElementById("brightness-val");
const saturationInput = document.getElementById("saturation");
const saturationVal = document.getElementById("saturation-val");
const sharpenInput = document.getElementById("sharpen");
const submitBtn = document.getElementById("submit-btn");
const resultMessage = document.getElementById("result-message");
const gallery = document.getElementById("gallery");
const statusBadge = document.getElementById("status-badge");

fileInput.addEventListener("change", () => {
  dropzoneLabel.textContent = fileInput.files[0] ? fileInput.files[0].name : "Click to choose an image";
});
brightnessInput.addEventListener("input", () => (brightnessVal.textContent = brightnessInput.value));
saturationInput.addEventListener("input", () => (saturationVal.textContent = saturationInput.value));

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    const dbTag = data.db === "connected" ? "db ✓" : "db ✗";
    statusBadge.textContent = `● backend online (${data.hostname}) · ${dbTag}`;
    statusBadge.className = data.db === "connected" ? "badge online" : "badge offline";
  } catch (err) {
    statusBadge.textContent = "● backend offline";
    statusBadge.className = "badge offline";
  }
}

async function loadGallery() {
  try {
    const res = await fetch("/api/enhancements");
    const items = await res.json();
    if (!items.length) {
      gallery.innerHTML = '<p class="empty-state">No enhanced images yet — upload one to get started.</p>';
      return;
    }
    gallery.innerHTML = items
      .slice(0, 12)
      .map(item => `<img src="${item.url}" alt="Enhanced image" loading="lazy" />`)
      .join("");
  } catch (err) {
    // gallery is a nice-to-have; fail silently
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fileInput.files[0]) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Enhancing…";
  resultMessage.textContent = "";
  resultMessage.className = "";

  const formData = new FormData();
  formData.append("image", fileInput.files[0]);
  formData.append("width", widthInput.value);
  formData.append("brightness", brightnessInput.value);
  formData.append("saturation", saturationInput.value);
  formData.append("sharpen", sharpenInput.checked);

  try {
    const res = await fetch("/api/enhance", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Enhancement failed");

    resultMessage.textContent = `Done! ${data.width}×${data.height}, ${data.sizeBytes} bytes (was ${data.originalSizeBytes}) — processed by ${data.processedBy}`;
    resultMessage.className = "success";
    loadGallery();
  } catch (err) {
    resultMessage.textContent = `Error: ${err.message}`;
    resultMessage.className = "error";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Enhance Image";
  }
});

checkHealth();
loadGallery();
setInterval(checkHealth, 10000);
