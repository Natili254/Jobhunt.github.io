fetch("/api/jobs")
.then(res => res.json())
.then(data => {
    const jobsDiv = document.getElementById("jobs");

    data.forEach(job => {
        jobsDiv.innerHTML += `
            <div class="job">
                <h3>${job.title}</h3>
                <p>${job.company} - ${job.location}</p>
                <p>${job.salary}</p>
            </div>
        `;
    });
});
