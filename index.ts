import * as fetch from 'node-fetch';

// Usage: CIRCLECI_TOKEN=12345 CIRCLECI_PROJECT_SLUG=github/orgname/reponame yarn start

const project_slug = process.env.CIRCLECI_PROJECT_SLUG;
const headers = {
  'Circle-Token': process.env.CIRCLECI_TOKEN,
};

const failing_tests: Record<string, number> = {};

async function getData() {
  console.log(`https://circleci.com/api/v2/insights/${project_slug}/workflows?branch=master&reporting-window=last-30-days`);
  const workflows_res = await fetch(`https://circleci.com/api/v2/insights/${project_slug}/workflows?branch=master&reporting-window=last-30-days`, {
    headers,
  });
  const workflows = await workflows_res.json();

  for (const workflow of workflows.items) {
    console.log(`workflow ${workflow.name} success rate: ${workflow.metrics.success_rate * 100}%`);
    const jobs_res = await fetch(`https://circleci.com/api/v2/insights/${project_slug}/workflows/${workflow.name}/jobs?branch=master&reporting-window=last-30-days`, {
      headers,
    });
    const jobs = await jobs_res.json();

    for (const job of jobs.items) {
      console.log(`job ${job.name} success rate: ${job.metrics.success_rate * 100}%`);
    }

    console.log(`https://circleci.com/api/v2/insights/${project_slug}/workflows/${workflow.name}/jobs/${workflow.name}?branch=master&reporting-window=last-30-days`);
    // TODO: check next_page_token and re-request until it's empty
    const runs_res = await fetch(`https://circleci.com/api/v2/insights/${project_slug}/workflows/${workflow.name}?branch=master&reporting-window=last-30-days`, {
      headers,
    });
    const runs_data = await runs_res.json();
    const failed_runs = runs_data.items.filter(r => r.status !== 'success');

    for (const failed_run of failed_runs) {
      console.log(`https://circleci.com/api/v2/workflow/${failed_run.id}/job`, failed_run.status);
      const workflow_run_jobs_res = await fetch(`https://circleci.com/api/v2/workflow/${failed_run.id}/job`, { headers });
      const workflow_run_jobs = await workflow_run_jobs_res.json();
      const failed_jobs = workflow_run_jobs.items.filter(r => r.status !== 'success');

      for (const failed_job of failed_jobs) {
        console.log(`https://circleci.com/api/v2/project/${project_slug}/${failed_job.job_number}/tests`, failed_job.status);
        const tests_res = await fetch(`https://circleci.com/api/v2/project/${project_slug}/${failed_job.job_number}/tests`, { headers });
        const tests = await tests_res.json();

        for (const test of tests.items) {
          if (test.result === 'success' || test.result === 'skipped' || test.result === 'system-out') {
            continue;
          }
          console.log(test);
          if (!failing_tests[test.name]) {
            failing_tests[test.name] = 0;
          }
          ++failing_tests[test.name];
        }
      }
    }
  }
  const sorted_tests = Object.entries(failing_tests).sort((a, b) => b[1] - a[1]);
  for (const test of sorted_tests) {
    console.log(`${test[1]} failures ${test[0]}`);
  }
}

getData();
