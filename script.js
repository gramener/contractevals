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

const mergeFields = [
  "Rights granted",
  "Type 1 Grant",
  "Type 2 Grant",
  "Type 3 Grant",
  "Author reserved rights",
  "Representations/Warranties",
  "Governing Law",
  "Copyright",
  "Agreement Term",
  "Amendments/Appendices",
  "Amendment/Appendix Summary",
  "Author/s approvals",
  "Permission Request",
  "Licensing Recommendation",
]

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
      "Parties' Signature",
      // "Licensing Recommendation",
      // "Rationale",
      // 'Type 1 Grant',
      // 'Type 2 Grant',
      // 'Type 3 Grant',
      // "Governing Law",
      // 'Agreement Term',
      // "Amendments/Appendices",
      // "Amendment/Appendix Summary",
      "Rights granted - AI Output",
      "Rights granted - Rationale",
      "Type 1 Grant - AI Output",
      "Type 1 Grant - Rationale",
      "Type 2 Grant - AI Output",
      "Type 2 Grant - Rationale",
      "Type 3 Grant - AI Output",
      "Type 3 Grant - Rationale",
      "Author reserved rights - AI Output",
      "Author reserved rights - Rationale",
      "Representations/Warranties - AI Output",
      "Representations/Warranties - Rationale",
      "Governing Law - AI Output",
      "Governing Law - Rationale",
      "Copyright - AI Output",
      "Copyright - Rationale",
      "Agreement Term - AI Output",
      "Agreement Term - Rationale",
      "Amendments/Appendices - AI Output",
      "Amendments/Appendices - Rationale",
      "Amendment/Appendix Summary - AI Output",
      // "Amendment/Appendix Summary - Rationale",
      "Author/s approvals - AI Output",
      "Author/s approvals - Rationale",
      "Permission Request - AI Output",
      "Permission Request  - Rationale",
      "Licensing Recommendation - AI Output",
      "Licensing Recommendation - Rationale"
    ];
    const missingFields = requiredFields.filter((field) => !csvData.some((row) => row[field]));
    if (missingFields.length > 0) {
      return displayFeedback(`Missing required fields: ${missingFields.join(", ")}.`, "danger");
    }

    for (const row of csvData) {
      for (const mf of mergeFields) {
        row[mf] = row[`${mf} - AI Output`] + "\n\nRationale: " + row[`${mf} - Rationale`];
      }

      if (row["Parties' Signature"] == undefined)
        row["Parties' Signature"] = '';

      // Process the "Parties' Signature" field
      const signedStatus = row["Parties' Signature"].trim();
      row["Signed"] = signedStatus.match(/Fully signed/i)
        ? `<i class="bi bi-check-square-fill text-success"></i>`
        : signedStatus.match(/Not signed/i) || signedStatus === ""
          ? `<i class="bi bi-x-square-fill text-danger"></i>`
          : `<i class="bi bi-circle-fill text-warning"></i>`;

      if (row["Licensing Recommendation"] == undefined)
        row["Licensing Recommendation"] = '';

      row["Recommendation"] = row["Licensing Recommendation"].match(/\bYes\b/i)
        ? `<i class="bi bi-circle-fill text-success"></i>`
        : row["Licensing Recommendation"].match(/\bNo\b/i)
          ? `<i class="bi bi-circle-fill text-danger"></i>`
          : `<i class="bi bi-circle-fill text-warning"></i>`;

      row["Rights Grant"] =
        row['Type 1 Grant'] +
        "\r\n\r\n" +
        row['Type 2 Grant'] +
        "\r\n\r\n" +
        row['Type 3 Grant'];

      row["ISBN"] = row["ISBN"].replace(/^B/, "");
    }

    // Process the CSV data here
    renderTable(csvData.filter((row) => row["Licensing Recommendation"]));
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
    keys: ["ISBN", "Signatory", "Rights Grant", "Governing Law"],
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
            <th class="text-center" @click=${() => sortData("Signed")}>
              Signed ${sortColumn === "Signed" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("Recommendation")}>
              Reco ${sortColumn === "Recommendation" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("Rationale")}>
              Why ${sortColumn === "Rationale" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("Rights Grant")}>
              Grant ${sortColumn === "Rights Grant" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("Governing Law")}>
              Governing Law
              ${sortColumn === "Governing Law" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData('Agreement Term')}>
              Term ${sortColumn === 'Agreement Term' ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
            <th @click=${() => sortData("Amendments/Appendices")}>
              Amendments ${sortColumn === "Amendments/Appendices" ? (sortDirection > 0 ? "▲" : "▼") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          ${data.map(
    (row, i) => {
      return html`
              <tr data-id="${i}" @click=${() => showContractDetails(row)}>
                <td><a href="${row["eLIB link"]}" target="_blank">${row["ISBN"]}</a></td>
                <td>
                  ${row["Signatory Name"]}
                  <div class="small">${row["Signatory Location"]}</div>
                </td>
                <td class="text-end">${formatDate(row["Agreement Date"])}</td>
                <td class="text-center" title="${row["Parties' Signature"]}">${formatString(row["Signed"])}</td>
                <td title="${row["Licensing Recommendation"]}">${formatString(row["Recommendation"])}</td>
                <td title='${row["Rationale"]}'>${formatString(row["Rationale"])}</td>
                <td title='${row["Rights Grant"]}'>${formatString(row["Rights Grant"])}</td>
                <td title='${row["Governing Law"]}'>${formatString(row["Governing Law"])}</td>
                <td title='${row["Agreement Term"]}'>${formatString(row['Agreement Term'])}</td>
                <td title='${row["Amendment/Appendix Summary"]}'>${formatString(row["Amendments/Appendices"])} ${formatString(row["Amendment/Appendix Summary"])}</td>
              </tr>
            `;
    }
  )}
        </tbody>
      </table>
    </div>
  `;

  render(tableTemplate(data), $tableContainer);
}

let currentRowIndex = -1;

function showContractDetails(row) {
  // console.log(row);
  currentRowIndex = filteredData.findIndex((r) => r === row);
  updateModalContent(row);
}

function updateModalContent(row) {
  $modalTitle.textContent = `Contract Details for ${row["Signatory Name"]}`;

  const tableContent = Object.entries(row)
    .map(
      ([key, value]) => {
        let k = key;
        if (k.match(/- (AI Output|Rationale)$/i) || k == '')
          return '';
        let v = value instanceof Date ? formatDate(value) : value;
        if (typeof v === 'string' || v instanceof String) {
          v = v.replace(/([\n\r])(\w+): ([^<>\n\r]+)/g, "$1<b>$2:</b> <i>$3</i>").replace(/\n/g, "<br>");
        }
        return `<tr><th scope="row">${k}</th><td>${v}</td></tr>`;
      }
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

function formatString(value) {
  if (typeof value === 'string' || value instanceof String) {
    let str = value;
    str = str.replace('&', '&amp;');
    str = str.replace(/([\n\r])(\w+): ([^<>\n\r]+)/g, '$1<b>$2:</b> <i>$3</i>').replace(/[\n\r]+/g, '<br />');
    var temp = document.createElement('span');
    temp.innerHTML = str;
    return temp;
  }
  return value || "";
}

function shorten(text, maxLength) {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
}
