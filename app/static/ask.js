// Follow-up Q&A on the result page: POST /api/ask and render the reply in
// place, no page reload.
//
// Two rules drive the shape of this file:
//   1. A refusal must look visibly different from an answer. "We don't know"
//      being mistaken for "here is the answer" is the product's single
//      biggest risk (01-BUSINESS-PLAN.md section 5).
//   2. Citations are always rendered when present, never suppressed because
//      the answer text reads as self-contained.
(function () {
  const form = document.getElementById("ask-form");
  const output = document.getElementById("ask-answer");
  if (!form || !output) return;

  const input = form.querySelector("#question");
  const button = form.querySelector("button");

  function render(variant, heading, body, citations) {
    output.className = variant;
    output.hidden = false;
    output.replaceChildren();

    if (heading) {
      const h = document.createElement("h3");
      h.textContent = heading;
      output.appendChild(h);
    }

    // textContent, never innerHTML: `body` is model output and must never be
    // parsed as markup.
    const p = document.createElement("p");
    p.textContent = body;
    output.appendChild(p);

    if (!citations || citations.length === 0) return;

    const label = document.createElement("p");
    label.className = "source";
    label.textContent = "Sources:";
    output.appendChild(label);

    const list = document.createElement("ul");
    list.className = "citations";
    for (const url of citations) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = url;
      link.textContent = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.appendChild(link);
      list.appendChild(item);
    }
    output.appendChild(list);
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    button.disabled = true;
    render("pending", "", "Checking our sources…", []);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: form.dataset.country, question: question }),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);

      const data = await response.json();
      if (data.refused) {
        render("refused", "Not found in our sources", data.answer, data.citations);
      } else {
        render("grounded", "Answer", data.answer, data.citations);
      }
    } catch (error) {
      render(
        "error",
        "Something went wrong",
        "The question could not be sent. Please try again.",
        []
      );
    } finally {
      button.disabled = false;
    }
  });
})();
