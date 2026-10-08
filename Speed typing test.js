// script.js
document.addEventListener("DOMContentLoaded", function() {
    // Elements
    const timerEl = document.getElementById("timer");
    const quoteDisplayEl = document.getElementById("quoteDisplay");
    const resultEl = document.getElementById("result");
    const quoteInputEl = document.getElementById("quoteInput");
    const startBtnEl = document.getElementById("startBtn");
    const submitBtnEl = document.getElementById("submitBtn");
    const resetBtnEl = document.getElementById("resetBtn");

    // Defensive checks
    if (!timerEl || !quoteDisplayEl || !quoteInputEl || !startBtnEl || !submitBtnEl || !resetBtnEl) {
        console.error("Required DOM elements are missing.");
        return;
    }

    // State
    let count = 0;
    let setTimer = null;
    let pasteDetected = false;
    let quoteText = "";
    let timerRunning = false;

    // Utility: start timer
    function startTimer() {
        stopTimer();
        count = 0;
        timerEl.textContent = count;
        setTimer = setInterval(() => {
            count += 1;
            timerEl.textContent = count;
        }, 1000);
        timerRunning = true;
    }

    // Stop timer
    function stopTimer() {
        if (setTimer !== null) {
            clearInterval(setTimer);
            setTimer = null;
        }
        timerRunning = false;
    }

    // Render quote as spans to make copying harder
    function renderQuoteAsSpans(text) {
        quoteDisplayEl.innerHTML = "";
        for (const ch of text) {
            const span = document.createElement("span");
            span.textContent = ch;
            quoteDisplayEl.appendChild(span);
        }
    }

    // Improved normalization for comparison
    function normalizeText(s) {
        if (typeof s !== "string") return "";
        // Unicode normalize
        let t = s.normalize("NFC");
        // Replace common curly quotes/apostrophes with straight ones
        t = t.replace(/[\u2018\u2019\u00B4\u0060]/g, "'"); // single quotes -> '
        t = t.replace(/[\u201C\u201D]/g, '"'); // double quotes -> "
        // Replace common dashes with hyphen
        t = t.replace(/[\u2013\u2014\u2212]/g, "-");
        // Collapse whitespace
        t = t.replace(/\s+/g, " ").trim();
        return t;
    }

    // Find first differing index between two strings
    function firstDiffIndex(a, b) {
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            if (a[i] !== b[i]) return i;
        }
        if (a.length !== b.length) return len;
        return -1; // identical
    }

    // Reset paste flag and UI hints
    function resetPasteFlagAndUI() {
        pasteDetected = false;
        resultEl.textContent = "";
    }

    // Fetch random quote and show instantly
    async function loadQuote() {
        resetPasteFlagAndUI();
        quoteInputEl.value = "";
        submitBtnEl.disabled = true;
        startBtnEl.disabled = true;
        quoteInputEl.disabled = true;
        stopTimer();
        timerEl.textContent = "0";

        quoteDisplayEl.textContent = "Loading quote…";
        try {
            const response = await fetch("https://apis.ccbp.in/random-quote");
            if (!response.ok) throw new Error("Network response was not ok");
            const jsonData = await response.json();
            quoteText = jsonData.content || "";
            renderQuoteAsSpans(quoteText);

            // Ready for user to start
            startBtnEl.disabled = false;
            resultEl.textContent = "Click Start to begin timing.";
        } catch (err) {
            quoteText = "";
            quoteDisplayEl.textContent = "Failed to load quote. Click New Quote to try again.";
            resultEl.textContent = "";
            startBtnEl.disabled = true;
            console.error("Fetch error:", err);
        }
    }

    // Initial load
    loadQuote();

    // Reset / New Quote
    resetBtnEl.addEventListener("click", loadQuote);

    // -------------------------
    // Paste-blocking handlers
    // -------------------------
    quoteInputEl.addEventListener("beforeinput", (e) => {
        if (e.inputType === "insertFromPaste") {
            e.preventDefault();
            pasteDetected = true;
            resultEl.textContent = "Pasting is disabled. Type the quote manually.";
        }
    });

    quoteInputEl.addEventListener("paste", (e) => {
        e.preventDefault();
        pasteDetected = true;
        resultEl.textContent = "Pasting is disabled. Type the quote manually.";
    });

    quoteInputEl.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "v") {
            e.preventDefault();
            pasteDetected = true;
            resultEl.textContent = "Paste shortcut disabled.";
        }
    });

    [quoteDisplayEl, quoteInputEl].forEach((el) => {
        el.addEventListener("contextmenu", (e) => e.preventDefault());
    });

    quoteInputEl.addEventListener("drop", (e) => {
        e.preventDefault();
        pasteDetected = true;
        resultEl.textContent = "Dropping text is disabled.";
    });

    // -------------------------
    // Start button behavior
    // -------------------------
    startBtnEl.addEventListener("click", () => {
        if (!quoteText) {
            resultEl.textContent = "No quote loaded. Click New Quote.";
            return;
        }
        resetPasteFlagAndUI();
        quoteInputEl.value = "";
        quoteInputEl.disabled = false;
        quoteInputEl.focus();
        startBtnEl.disabled = true;
        submitBtnEl.disabled = false;
        startTimer();
    });

    // -------------------------
    // Submit logic with helpful diff feedback
    // -------------------------
    submitBtnEl.addEventListener("click", () => {
        if (!quoteText) {
            resultEl.textContent = "No valid quote to compare. Click New Quote to load a quote.";
            return;
        }

        if (pasteDetected) {
            resultEl.textContent = "Submission blocked: paste detected. Type the quote manually.";
            return;
        }

        const typedRaw = quoteInputEl.value;
        const typed = normalizeText(typedRaw);
        const original = normalizeText(quoteText);

        const diffIdx = firstDiffIndex(typed, original);
        if (diffIdx === -1) {
            // correct
            stopTimer();
            const elapsedSeconds = parseInt(timerEl.textContent, 10) || 0;
            resultEl.textContent = `Correct! You typed it in ${elapsedSeconds} seconds.`;
            submitBtnEl.disabled = true;
            startBtnEl.disabled = false; // allow retry same quote
            quoteInputEl.disabled = true;
        } else {
            // show helpful message pointing to the first mismatch
            const expectedChar = original[diffIdx] === undefined ? "␀(end)" : original[diffIdx];
            const gotChar = typed[diffIdx] === undefined ? "␀(end)" : typed[diffIdx];
            // If the mismatch is only a quote/apostrophe difference, give a friendly hint
            const isQuoteMismatch =
                (expectedChar === "'" && gotChar === "’") ||
                (expectedChar === "’" && gotChar === "'") ||
                (expectedChar === '"' && (gotChar === "“" || gotChar === "”")) ||
                ((expectedChar === "“" || expectedChar === "”") && gotChar === '"');

            if (isQuoteMismatch) {
                resultEl.textContent = `Mismatch at character ${diffIdx + 1}: expected a curly/straight quote difference. Check apostrophes/quotes.`;
            } else {
                resultEl.textContent = `Mismatch at character ${diffIdx + 1}: expected "${expectedChar}" but got "${gotChar}".`;
            }
            // keep timer running so user can correct
        }
    });

    // Accessibility: focus input when quote clicked
    quoteDisplayEl.addEventListener("click", () => {
        if (!quoteInputEl.disabled) quoteInputEl.focus();
    });
    quoteDisplayEl.addEventListener("selectstart", (e) => e.preventDefault());
});