import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@2.7.5/lit-html.min.js";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.js";

const $fileInput = document.getElementById("file");
const $uploadFeedback = document.getElementById("upload-feedback");
const $tableContainer = document.getElementById("table-container");
const $modalTitle = document.getElementById("contract-modal-title");
const $modalBody = document.getElementById("contract-modal-body");
const $contractModal = document.getElementById("contract-modal");
const modal = new bootstrap.Modal($contractModal);

$fileInput.addEventListener("change", handleFileUpload);

async function handleFileUpload() {
  const file = $fileInput.files[0];
  if (!file || file.name.split(".").at(-1).toLowerCase() !== "csv")
    return displayFeedback("Please upload a CSV file.", "danger");

  try {
    const csvData = await d3.csv(URL.createObjectURL(file), (row) => {
      // Convert date fields to Date objects, or keep as string if invalid
      const dateFields = ["Contract Signing Date", "Latest Signing Date", "Agreement Date"];
      dateFields.forEach((field) => {
        const parsedDate = new Date(row[field]);
        row[field] = !isNaN(parsedDate) ? parsedDate : row[field];
      });
      return row;
    });

    // Check if the file has all the required fields
    const requiredFields = [
      "ISBN",
      "eLIB link",
      "Signatory Name",
      "Signatory Location",
      "Wiley Entity",
      "Contract Signing Date",
      "Latest Signing Date",
      "Agreement Date",
      "Is agreement fully signed by all parties",
      "Recommendation for Licensing",
      "Rationale",
      'Type of Rights Grant, Part 1 ("copyright assignment", "copyright transfer or license", "other")',
      'Type of Rights Grant, Part 2: "Exclusive" or "Non-Exclusive" or Silent',
      'Type of Rights Grant, Part 3: "Revocable" or "Irrevocable" or Silent',
      "Governing Law (Country or State only)",
      'Term of Agreement ("Full Term of Copyright", or Language if "Other")',
      "Amendments/Appendices (Y/N)",
      "Summary of Amendment/Appendix",
    ];
    const missingFields = requiredFields.filter((field) => !csvData.some((row) => row[field]));
    if (missingFields.length > 0) {
      return displayFeedback(`Missing required fields: ${missingFields.join(", ")}.`, "danger");
    }

    for (const row of csvData) {
      // Process the "Is agreement fully signed by all parties?" field
      const signedStatus = row["Is agreement fully signed by all parties"].trim();
      row["signed"] = signedStatus.match(/Fully signed/i)
        ? html`<i class="bi bi-check-square-fill text-success"></i>`
        : signedStatus.match(/Not signed/i) || signedStatus === ""
        ? html`<i class="bi bi-x-square-fill text-danger"></i>`
        : html`<i class="bi bi-circle-fill text-warning"></i>`;
      row["recommendation"] = row["Recommendation for Licensing"].match(/\bYes\b/i)
        ? html`<i class="bi bi-circle-fill text-success"></i>`
        : row["Recommendation for Licensing"].match(/\bNo\b/i)
        ? html`<i class="bi bi-circle-fill text-danger"></i>`
        : html`<i class="bi bi-circle-fill text-warning"></i>`;

      row["rights-grant"] =
        row['Type of Rights Grant, Part 1 ("copyright assignment", "copyright transfer or license", "other")'] +
        " " +
        row['Type of Rights Grant, Part 2: "Exclusive" or "Non-Exclusive" or Silent'] +
        row['Type of Rights Grant, Part 3: "Revocable" or "Irrevocable" or Silent'];
      row["ISBN"] = row["ISBN"].replace(/^B/, "");
    }

    // Process the CSV data here
    renderTable(csvData.filter((row) => row["Recommendation for Licensing"]));
    displayFeedback("File uploaded and processed successfully!", "success");
  } catch (error) {
    console.error(error);
    displayFeedback(`Error reading CSV: ${error.message}`, "danger");
  }
}

let filteredData;

function renderTable(data) {
  filteredData = data;
  let sortColumn = null;
  let sortDirection = 1;
  let fuse = new Fuse(data, {
    keys: ["ISBN", "Signatory", "rights-grant", "Governing Law (Country or State only)"],
    threshold: 0.4,
  });

  const sortData = (column) => {
    if (sortColumn === column) {
      sortDirection *= -1;
    } else {
      sortColumn = column;
      sortDirection = 1;
    }

    data.sort((a, b) => {
      const aValue = a[column];
      const bValue = b[column];
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection * (aValue.getTime() - bValue.getTime());
      }
      return sortDirection * String(aValue).localeCompare(String(bValue));
    });

    render(tableTemplate(data), $tableContainer);
  };

  const searchData = (event) => {
    const searchTerm = event.target.value;
    if (searchTerm) {
      filteredData = fuse.search(searchTerm).map((result) => result.item);
    } else {
      filteredData = data;
    }
    render(tableTemplate(filteredData), $tableContainer);
  };

  const tableTemplate = (data) => html`
    <input type="text" class="form-control" placeholder="Search by ISBN" @input=${searchData} />
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th @click=${() => sortData("ISBN")}>
              ISBN ${sortColumn === "ISBN" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("Signatory Name")}>
              Signatory ${sortColumn === "Signatory Name" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th class="text-end" @click=${() => sortData("Agreement Date")}>
              Date ${sortColumn === "Agreement Date" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th class="text-center" @click=${() => sortData("signed")}>
              Signed ${sortColumn === "signed" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("recommendation")}>
              Reco ${sortColumn === "recommendation" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("Rationale")}>
              Why ${sortColumn === "Rationale" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("rights-grant")}>
              Grant ${sortColumn === "rights-grant" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("Governing Law (Country or State only)")}>
              Governing Law
              ${sortColumn === "Governing Law (Country or State only)" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData('Term of Agreement ("Full Term of Copyright", or Language if "Other")')}>
              Term
              ${sortColumn === 'Term of Agreement ("Full Term of Copyright", or Language if "Other")'
                ? sortDirection > 0
                  ? "▲"
                  : "▼"
                : ""}
            </th>
            <th @click=${() => sortData("Amendments/Appendices (Y/N)")}>
              Amendments ${sortColumn === "Amendments/Appendices (Y/N)" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          ${data.map(
            (row, i) => html`
              <tr data-id="${i}" @click=${() => showContractDetails(row)}>
                <td><a href="${row["eLIB link"]}" target="_blank">${row["ISBN"]}</a></td>
                <td>
                  ${row["Signatory Name"]}
                  <div class="small">${row["Signatory Location"]}</div>
                </td>
                <td class="text-end">${formatDate(row["Agreement Date"])}</td>
                <td class="text-center" title="${row["Is agreement fully signed by all parties"]}">${row["signed"]}</td>
                <td title="${row["Recommendation for Licensing"]}">${row["recommendation"]}</td>
                <td>${row["Rationale"]}</td>
                <td>${row["rights-grant"]}</td>
                <td>${shorten(row["Governing Law (Country or State only)"], 30)}</td>
                <td>${shorten(row['Term of Agreement ("Full Term of Copyright", or Language if "Other")'], 30)}</td>
                <td>${row["Amendments/Appendices (Y/N)"]} ${shorten(row["Summary of Amendment/Appendix"], 100)}</td>
              </tr>
            `
          )}
        </tbody>
      </table>
    </div>
  `;

  render(tableTemplate(data), $tableContainer);
}

let currentRowIndex = -1;

function showContractDetails(row) {
  console.log(row);
  currentRowIndex = filteredData.findIndex((r) => r === row);
  updateModalContent(row);
}

function updateModalContent(row) {
  $modalTitle.textContent = `Contract Details for ${row["Signatory Name"]}`;

  const tableContent = Object.entries(row)
    .map(
      ([key, value]) => `
      <tr>
        <th scope="row">${key}</th>
        <td>${value instanceof Date ? formatDate(value) : value}</td>
      </tr>
    `
    )
    .join("");

  $modalBody.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped">
        <tbody>
          ${tableContent}
        </tbody>
      </table>
    </div>
  `;

  if (!$contractModal.classList.contains("show")) modal.show();
}

document.addEventListener("keydown", handleKeyPress);

function handleKeyPress(event) {
  if (!$contractModal.classList.contains("show")) return;

  switch (event.key) {
    case "ArrowLeft":
    case "ArrowUp":
      navigateModal(-1);
      break;
    case "ArrowRight":
    case "ArrowDown":
      navigateModal(1);
      break;
  }
}

function navigateModal(direction) {
  const newIndex = currentRowIndex + direction;
  if (newIndex >= 0 && newIndex < filteredData.length) {
    currentRowIndex = newIndex;
    updateModalContent(filteredData[currentRowIndex]);
  }
}

function formatDate(value) {
  if (value instanceof Date && !isNaN(value)) {
    return value.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  return value || "";
}

function displayFeedback(message, status) {
  // Avoid lit-html since Bootstrap's dismissible alert doesn't work with it
  $uploadFeedback.innerHTML = /* html */ `
    <div class="alert alert-${status} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function shorten(text, maxLength) {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
}
