(function () {
  "use strict";

  const SEAL_MARKUP = (id, word) => `
    <svg viewBox="0 0 132 132" xmlns="http://www.w3.org/2000/svg">
      <g class="seal-inner-group">
        <circle class="seal-ring-outer" cx="66" cy="66" r="60"/>
        <circle class="seal-ring-inner" cx="66" cy="66" r="51"/>
        <path id="${id}" d="M 66,17 A 49,49 0 1 1 65.9,17" fill="none"/>
        <text class="seal-word">
          <textPath href="#${id}" startOffset="4%">${word}</textPath>
        </text>
        <path class="seal-glyph" d="M66 46 L74 62 L92 64 L79 76 L82 94 L66 85 L50 94 L53 76 L40 64 L58 62 Z" transform="scale(0.62) translate(40,40)"/>
      </g>
    </svg>`;

  const heroSeal = document.getElementById("heroSeal");
  const reportSeal = document.getElementById("reportSeal");
  heroSeal.innerHTML = SEAL_MARKUP("sealPathHero", "NO FAKE · NO FAKE ·");

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const previewRow = document.getElementById("previewRow");
  const previewThumb = document.getElementById("previewThumb");
  const previewName = document.getElementById("previewName");
  const previewSub = document.getElementById("previewSub");
  const previewClear = document.getElementById("previewClear");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const statusLine = document.getElementById("statusLine");
  const report = document.getElementById("report");
  const verdictLabel = document.getElementById("verdictLabel");
  const verdictSummary = document.getElementById("verdictSummary");
  const confidenceValue = document.getElementById("confidenceValue");
  const confidenceFill = document.getElementById("confidenceFill");
  const indicesList = document.getElementById("indicesList");
  const disclaimerText = document.getElementById("disclaimerText");
  const iaReveal = document.getElementById("iaReveal");
  const iaRevealImg = document.getElementById("iaRevealImg");

  let currentBlob = null;
  let isVideo = false;
  let objectUrl = null;

  const VERDICTS = {
    authentique: { label: "Authentique", color: "var(--ok)" },
    montage:     { label: "Montage détecté", color: "var(--warn)" },
    ia:          { label: "Généré par IA", color: "var(--danger)" }
  };

  function setStatus(msg, isError) {
    statusLine.textContent = msg || "";
    statusLine.classList.toggle("err", !!isError);
  }

  // ---------- file handling ----------

  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
  previewClear.addEventListener("click", (e) => { e.preventDefault(); resetFile(); });

  function resetFile() {
    currentBlob = null;
    isVideo = false;
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    fileInput.value = "";
    previewRow.hidden = true;
    analyzeBtn.disabled = true;
    setStatus("");
    report.hidden = true;
  }

  function handleFile(file) {
    report.hidden = true;
    setStatus("");
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) { setStatus("Ce type de fichier n'est pas pris en charge.", true); return; }
    isVideo = isVid;

    if (isImg) {
      currentBlob = file;
      objectUrl = URL.createObjectURL(file);
      showPreview(objectUrl, file.name, "Image");
    } else {
      setStatus("Extraction d'une image de la vidéo…");
      extractVideoFrame(file).then((blob) => {
        currentBlob = blob;
        objectUrl = URL.createObjectURL(blob);
        showPreview(objectUrl, file.name, "Image extraite de la vidéo");
        setStatus("");
      }).catch(() => {
        setStatus("Impossible de lire cette vidéo.", true);
        resetFile();
      });
    }
  }

  function showPreview(url, name, sub) {
    previewThumb.src = url;
    previewName.textContent = name;
    previewSub.textContent = sub;
    previewRow.hidden = false;
    analyzeBtn.disabled = false;
  }

  function extractVideoFrame(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;
      const cleanup = () => URL.revokeObjectURL(url);

      video.addEventListener("loadedmetadata", () => {
        const t = Math.min(1, Math.max(0.1, video.duration / 2 || 0.1));
        video.currentTime = t;
      });
      video.addEventListener("seeked", () => {
        try {
          const maxW = 1280;
          const scale = Math.min(1, maxW / video.videoWidth);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => { cleanup(); blob ? resolve(blob) : reject(new Error("empty blob")); }, "image/jpeg", 0.9);
        } catch (err) { cleanup(); reject(err); }
      });
      video.addEventListener("error", () => { cleanup(); reject(new Error("video error")); });
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Resize any image (not just video frames) down to a reasonable size
  // before sending it, to stay well under request-size limits.
  function downscaleIfNeeded(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const maxW = 1280;
        if (img.width <= maxW) { URL.revokeObjectURL(url); resolve(blob); return; }
        const scale = maxW / img.width;
        const canvas = document.createElement("canvas");
        canvas.width = maxW;
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => { URL.revokeObjectURL(url); resolve(b || blob); }, "image/jpeg", 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
      img.src = url;
    });
  }

  // ---------- analysis ----------

  analyzeBtn.addEventListener("click", async () => {
    if (!currentBlob) return;
    analyzeBtn.disabled = true;
    report.hidden = true;
    heroSeal.classList.add("working");
    setStatus("Examen en cours — quelques secondes…");

    try {
      const toSend = await downscaleIfNeeded(currentBlob);
      const base64 = await blobToBase64(toSend);
      const mediaType = toSend.type || "image/jpeg";

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType })
      });

      const data = await res.json();

      if (!res.ok) {
        renderError(data && data.error);
        return;
      }
      renderResult(data);
      setStatus("");
    } catch (e) {
      renderError("network");
    } finally {
      heroSeal.classList.remove("working");
      analyzeBtn.disabled = false;
    }
  });

  function renderError(code) {
    const map = {
      missing_key: "Le serveur n'est pas configuré (clé API manquante). Vérifiez la variable GEMINI_API_KEY sur Vercel.",
      too_large: "Ce fichier est trop volumineux. Essayez une image ou une vidéo plus légère.",
      rate_limited: "Trop de demandes pour l'instant (limite du niveau gratuit) — réessayez dans une minute.",
      upstream_error: "Le service d'analyse a rencontré un problème. Réessayez.",
      invalid_response: "La réponse reçue était illisible — réessayez.",
      network: "Impossible de contacter le serveur d'analyse. Vérifiez votre connexion et réessayez."
    };
    setStatus(map[code] || "Un problème est survenu pendant l'analyse. Réessayez.", true);
  }

  function renderResult(data) {
    const verdictKey = ["authentique", "montage", "ia"].includes(data.verdict) ? data.verdict : "montage";
    const v = VERDICTS[verdictKey];
    const confidence = Math.max(0, Math.min(100, Math.round(Number(data.confiance) || 0)));

    report.style.setProperty("--stamp-color", v.color);
    reportSeal.innerHTML = SEAL_MARKUP("sealPathReport", v.label.toUpperCase() + " · " + v.label.toUpperCase() + " ·");

    if (verdictKey === "ia" && objectUrl) {
      iaRevealImg.src = objectUrl;
      iaReveal.hidden = false;
    } else {
      iaReveal.hidden = true;
    }

    verdictLabel.textContent = v.label;
    verdictSummary.textContent = data.resume || "";
    confidenceValue.textContent = confidence + " %";
    confidenceFill.style.width = confidence + "%";

    indicesList.innerHTML = "";
    const indices = Array.isArray(data.indices) ? data.indices.slice(0, 4) : [];
    if (indices.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Aucun indice particulier n'a été relevé.";
      indicesList.appendChild(li);
    } else {
      indices.forEach((idx) => {
        const li = document.createElement("li");
        li.textContent = String(idx);
        indicesList.appendChild(li);
      });
    }

    disclaimerText.textContent = isVideo
      ? "Analyse réalisée sur une seule image extraite de la vidéo, et non sur l'ensemble du fichier. Il s'agit d'un avis visuel donné par une IA, pas d'une expertise judiciaire — les métadonnées du fichier ne sont pas examinées."
      : "Il s'agit d'un avis visuel donné par une IA, pas d'une expertise judiciaire. Les métadonnées du fichier ne sont pas examinées et aucun détecteur ne peut garantir un résultat certain à 100 %.";

    report.hidden = false;
    report.scrollIntoView({ behavior: "smooth", block: "start" });
  }
})();
