// =====================
// DATA STORAGE
// =====================
let employees = JSON.parse(localStorage.getItem("employees")) || [];
let records = JSON.parse(localStorage.getItem("records")) || [];
let faceDescriptors = JSON.parse(localStorage.getItem("faceDescriptors")) || {};
let clockedIn = {};

// =====================
// CAMERA SETUP
// =====================
const video = document.getElementById("camera");
const faceBox = document.getElementById("faceBox");
const faceMessage = document.getElementById("faceMessage");

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" }, audio: false 
        });
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        await video.play();
        console.log("Camera started successfully!");
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Cannot access camera. Check permissions and use HTTPS.");
    }
}
setupCamera();

// =====================
// LOAD FACE API MODELS
// =====================
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('https://unpkg.com/face-api.js@0.22.2/weights/'),
    faceapi.nets.faceLandmark68Net.loadFromUri('https://unpkg.com/face-api.js@0.22.2/weights/'),
    faceapi.nets.faceRecognitionNet.loadFromUri('https://unpkg.com/face-api.js@0.22.2/weights/')
]).then(() => {
    console.log("Face API Loaded ✓");
    startFaceDetectionLoop();
});

// =====================
// FACE DETECTION & AUTO CLOCK
// =====================
async function startFaceDetectionLoop() {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 });

    async function detect() {
        if (video.readyState === 4) {
            const detection = await faceapi.detectSingleFace(video, options)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detection) {
                faceBox.style.display = "block";
                const box = detection.detection.box;
                const scaleX = video.clientWidth / video.videoWidth;
                const scaleY = video.clientHeight / video.videoHeight;
                faceBox.style.left = `${box.x * scaleX}px`;
                faceBox.style.top = `${box.y * scaleY}px`;
                faceBox.style.width = `${box.width * scaleX}px`;
                faceBox.style.height = `${box.height * scaleY}px`;
                faceBox.classList.add("detected");

                let matchFound = false;
                for (let name in faceDescriptors) {
                    const stored = new Float32Array(faceDescriptors[name]);
                    const distance = faceapi.euclideanDistance(stored, detection.descriptor);
                    if (distance < 0.45) {
                        faceMessage.textContent = `Hello, ${name}!`;
                        if (!clockedIn[name]) {
                            clockIn(name);
                            clockedIn[name] = true;
                        } else {
                            let rec = records.find(r => r.name === name && !r.clockOut);
                            if (rec) {
                                clockOut(name);
                                clockedIn[name] = false;
                            }
                        }
                        matchFound = true;
                        break;
                    }
                }

                if (!matchFound) faceMessage.textContent = "Face not recognized.";
            } else {
                faceBox.style.display = "none";
                faceBox.classList.remove("detected");
                faceMessage.textContent = "Waiting for face...";
            }
        }
        setTimeout(detect, 100);
    }

    detect();
}
// =====================
// REGISTRATION FUNCTION
// =====================
async function registerFace() {
    let name = document.getElementById("empName").value.trim();
    let pin = document.getElementById("empPIN").value.trim();
    let companyNumber = document.getElementById("empCompanyNumber").value.trim();

    if (!name || !pin || pin.length !== 4 || !companyNumber) {
        return alert("Enter Name, 4-digit PIN, and Company Number.");
    }

    alert("Looking into the camera...");
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) return alert("Face not detected. Try again.");

    faceDescriptors[name] = Array.from(detection.descriptor);
    localStorage.setItem("faceDescriptors", JSON.stringify(faceDescriptors));

    employees.push({ name, pin, companyNumber });
    localStorage.setItem("employees", JSON.stringify(employees));

    updateEmployeeTable();
    alert("Employee Registered Successfully!");
}

// =====================
// CLOCK-IN / CLOCK-OUT
// =====================
function clockIn(name) {
    let now = new Date();
    records.push({ name, date: now.toLocaleDateString(), clockIn: now.toLocaleTimeString(), clockOut: "" });
    localStorage.setItem("records", JSON.stringify(records));
    updateRecordsTable();
    updateMonthlySummary();
    console.log(`${name} Clock-In`);
}

function clockOut(name) {
    let rec = records.find(r => r.name === name && r.clockOut === "");
    if (!rec) return;
    rec.clockOut = new Date().toLocaleTimeString();
    localStorage.setItem("records", JSON.stringify(records));
    updateRecordsTable();
    updateMonthlySummary();
    console.log(`${name} Clock-Out`);
}

// =====================
// ADMIN FUNCTIONS
// =====================
function updateEmployeeTable() {
    let tbody = document.querySelector("#employeeTable tbody");
    tbody.innerHTML = "";
    employees.forEach((e, index) => {
        tbody.innerHTML += `<tr>
            <td>${e.name}</td>
            <td>${e.companyNumber}</td>
            <td>${e.pin}</td>
            <td>
                <button onclick="editEmployee(${index})">Edit</button>
                <button onclick="deleteEmployee(${index})">Delete</button>
            </td>
        </tr>`;
    });
}

function updateRecordsTable() {
    let tbody = document.querySelector("#recordTable tbody");
    tbody.innerHTML = "";
    records.forEach(r => {
        tbody.innerHTML += `<tr>
            <td>${r.name}</td>
            <td>${r.date}</td>
            <td>${r.clockIn}</td>
            <td>${r.clockOut}</td>
        </tr>`;
    });
}

function updateMonthlySummary() {
    let sum = {};
    records.forEach(r => {
        if (!sum[r.name]) sum[r.name] = new Set();
        sum[r.name].add(r.date);
    });
    let box = document.getElementById("summaryBox");
    box.innerHTML = "";
    for (let name in sum) box.innerHTML += `${name}: <b>${sum[name].size} days</b><br>`;
}

function adminLogin() {
    let p = prompt("Enter admin password:");
    if (p === "admin123") document.getElementById("adminPanel").style.display = "block";
    else alert("Incorrect password.");
}

function editEmployee(index) {
    let newPin = prompt("Enter new 4-digit PIN:", employees[index].pin);
    if (newPin && newPin.length === 4) employees[index].pin = newPin;
    else if (newPin) alert("PIN must be 4 digits!");

    let newCompany = prompt("Enter new Company Number:", employees[index].companyNumber);
    if (newCompany) employees[index].companyNumber = newCompany;

    localStorage.setItem("employees", JSON.stringify(employees));
    updateEmployeeTable();
}
function deleteEmployee(index) {
    if (confirm(`Delete employee ${employees[index].name}?`)) {
        let name = employees[index].name;
        employees.splice(index, 1);
        delete faceDescriptors[name];
        localStorage.setItem("employees", JSON.stringify(employees));
        localStorage.setItem("faceDescriptors", JSON.stringify(faceDescriptors));
        updateEmployeeTable();
    }
}

// =====================
// EXPORT CSV / PDF
// =====================
function downloadCSV() {
    let csv = "Name,Date,Clock In,Clock Out\n";
    records.forEach(r => csv += `${r.name},${r.date},${r.clockIn},${r.clockOut}\n`);
    let file = new Blob([csv], { type: "text/csv" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = "attendance.csv";
    link.click();
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    let doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Icon Security - Monthly Attendance", 10, 10);
    let y = 20;
    records.forEach(r => {
        doc.text(`${r.name} | ${r.date} | Clock In: ${r.clockIn} | Clock Out: ${r.clockOut}`, 10, y);
        y += 10;
    });
    doc.save("attendance.pdf");
}

// =====================
// CLEAR DATA
// =====================
function clearAllData() {
    if (confirm("Delete ALL data?")) {
        localStorage.clear();
        employees = [];
        records = [];
        faceDescriptors = {};
        location.reload();
    }
}

// =====================
// INITIALIZE TABLES
// =====================
updateEmployeeTable();
updateRecordsTable();
updateMonthlySummary();