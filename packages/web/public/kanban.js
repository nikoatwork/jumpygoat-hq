(() => {
  const board = document.querySelector("[data-kanban]");
  if (!board) return;

  let dragged = null;

  function showMessage(message, tone = "info") {
    let messageEl = document.querySelector("[data-kanban-message]");
    if (!messageEl) {
      messageEl = document.createElement("p");
      messageEl.setAttribute("data-kanban-message", "");
      board.before(messageEl);
    }
    messageEl.className = `notice ${tone}`;
    messageEl.textContent = message;
  }

  function updateColumnCount(column) {
    const count = column.querySelector(".kanban-column-header .muted");
    if (!count) return;
    count.textContent = String(column.querySelectorAll(".kanban-card").length);
  }

  function updateEmptyState(column) {
    const zone = column.querySelector(".kanban-dropzone");
    if (!zone) return;
    const cards = zone.querySelectorAll(".kanban-card");
    zone.querySelectorAll("[data-empty-kanban]").forEach((empty) => empty.remove());
    if (!cards.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.dataset.emptyKanban = "true";
      empty.textContent = "No tasks.";
      zone.appendChild(empty);
    }
  }

  function moveCard(card, column, status) {
    const previousColumn = card.closest(".kanban-column");
    const zone = column.querySelector(".kanban-dropzone");
    if (!zone) return;
    zone.querySelectorAll("[data-empty-kanban]").forEach((empty) => empty.remove());
    zone.appendChild(card);
    card.querySelectorAll('input[name="status"]').forEach((input) => {
      if (input.value === status) input.closest("form")?.remove();
    });
    updateColumnCount(column);
    updateEmptyState(column);
    if (previousColumn && previousColumn !== column) {
      updateColumnCount(previousColumn);
      updateEmptyState(previousColumn);
    }
  }

  board.querySelectorAll(".kanban-card[draggable='true']").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      dragged = card;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `${card.dataset.board}/${card.dataset.taskId}`);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      dragged = null;
      board.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    });
  });

  board.querySelectorAll(".kanban-column[data-status]").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      if (!dragged) return;
      event.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      if (!dragged) return;
      const status = column.dataset.status;
      const sourceBoard = dragged.dataset.board;
      const id = dragged.dataset.taskId;
      if (!status || !sourceBoard || !id) return;
      const body = new URLSearchParams({ status, format: "json" });
      const response = await fetch(`/boards/${encodeURIComponent(sourceBoard)}/tasks/${encodeURIComponent(id)}/status`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Status update failed." }));
        showMessage(error.error || "Status update failed.", "error");
        return;
      }
      moveCard(dragged, column, status);
      showMessage(`Moved ${id} to ${column.querySelector("h3")?.textContent?.trim() || status}.`, "success");
    });
  });
})();
