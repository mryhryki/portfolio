window.addEventListener("click", (event) => {
  let element = event.target;
  while (element instanceof HTMLElement) {
    const isButton = element.tagName.toLowerCase() === "button";
    const isAnchor = element.tagName.toLowerCase() === "a";
    const copyText = typeof element.dataset.copytext === "string" ? element.dataset.copytext : "";
    if ((isButton || isAnchor) && copyText.trim() !== "") {
      event.preventDefault()
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          const { top, left } = element.getBoundingClientRect();
          console.debug(element.scrollWidth)
          console.dir(element)
          const div = document.createElement("div");
          div.style.backgroundColor = "chocolate";
          div.style.border = "1px solid white";
          div.style.borderRadius = "2px";
          div.style.color = "white";
          div.style.fontSize = "16px";
          div.style.height = "32px";
          div.style.left = `${left + element.scrollWidth / 2 - 40}px`;
          div.style.lineHeight = "32px";
          div.style.position = "fixed";
          div.style.top = `${top - 38}px`;
          div.style.width = `80px`;
          div.style.zIndex = "1";
          div.textContent = "Copied!";
          element.appendChild(div);
          setTimeout(() => element.removeChild(div), 1000);
        })
        .catch((err) => {
          console.error(err)
          alert("Copy Failed");
        });
      break;
    }
    element = element.parentNode;
  }
});
