(() => {
  const board = document.querySelector("[data-kanban]");
  if (!board) return;

  let dragged = null;

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
      const board = dragged.dataset.board;
      const id = dragged.dataset.taskId;
      if (!status || !board || !id) return;
      const body = new URLSearchParams({ status, format: "json" });
      const response = await fetch(`/boards/${encodeURIComponent(board)}/tasks/${encodeURIComponent(id)}/status`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Status update failed." }));
        window.alert(error.error || "Status update failed.");
        return;
      }
      window.location.reload();
    });
  });
})();
