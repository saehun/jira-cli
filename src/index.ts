import axios from "axios";
import * as R from "ramda";
import * as date from "date-fns";
import { writeSync } from "clipboardy";
import * as program from "commander";
import * as inquirer from "inquirer";
const chalk = require("chalk");
const version = require("../package.json").version;

/**
 * Configurable Settings
 */
const {
  JIRA_TOKEN,
  JIRA_EMAIL,
  JIRA_PROJECT_KEY,
  JIRA_ENDPOINT,
} = process.env;


/**
 * Hard coded Settings
 * const users = await getAllUsers();
 */
const SPRINT_BOARD_ID = "16";
const users = <const>["alan", "jackie", "jake", "joseph", "jun", "karl", "sean", "      "];
const USER_PAD = Math.max(...users.map(x => x.length));
const status = <const>["todo", "doing", "wait", "review", "done"];
const statusId = <const>[11, 21, 51, 41, 31];
const STATUS_PAD = 6;
const statusMap = <const>{
  "To Do": "todo",
  "In Progress": "doing",
  "대기": "wait",
  "리뷰": "review",
  "Done": "done"
};
/* typeof users[number]; */


/**
 * API endpoint
 * api  - JIRA Server platform REST api
 * api2 - JIRA Agile REST api
 */
const api = axios.create({
  baseURL: JIRA_ENDPOINT + "/api/2",
  timeout: 15000,
  auth: { username: JIRA_EMAIL, password: JIRA_TOKEN },
});
const api2 = axios.create({
  baseURL: JIRA_ENDPOINT + "/agile/1.0",
  timeout: 15000,
  auth: { username: JIRA_EMAIL, password: JIRA_TOKEN },
});


/********************************************************************************************************
 * REST API wrapper
 ********************************************************************************************************/

const getActiveSprint = async () => {
  const res = await api2.get(`board/${SPRINT_BOARD_ID}/sprint?state=active`);
  return res.data.values[0];
};

const getIssueBySprint = async (...args: (typeof users[number] | typeof status[number])[]): Promise<Issue[]> => {
  const sprint = await getActiveSprint();

  const assignees = args.filter((x: string) => users.includes(x as any));
  const statuses = args.filter((x: string) => status.includes(x as any));


  const jql = assignees.length === 0 ? "" : "&jql=" + assignees.map((x: string) => "assignee=" + x).join("%20OR%20");
  const res = await api2.get(`board/${SPRINT_BOARD_ID}/sprint/${sprint.id}/issue?maxResults=200${jql}`);

  const { issues } = res.data;
  return statuses.length === 0 ? issues
    : issues.filter((i: Issue) => statuses.includes((statusMap as any)[i.fields.status.name]));
};

const getAllUsers = async (): Promise<User[]> => {
  const res = await api.get(`user/assignable/search?project=${JIRA_PROJECT_KEY}`);
  const users = res.data as User[];
  return users.filter((user: User) => user.accountType === "atlassian" && user.key !== "admin");
};

const getIssues = async () => {
  const res = await api.post("search", {
    "jql": "project = SB",
    "startAt": 0,
    "maxResults": 200,
    "fields": [
      "summary",
      "status",
      "assignee"
    ]
  });
  return res.data.issues;
};

const getIssue = async (id: any) => {
  const res = await api.get(`issue/SB-${id}`);
  return res.data;
};


const updateIssueSummary = async (args: any) => {
  const options = args.filter((x: any) => typeof x === "string");
  if (options.length <= 1) {
    console.error("Need more argument. see --help");
    process.exit(0);
  }

  const [id, ...summaries] = options;
  const summary = summaries.join(" ");

  if (!/^\d+$/.test(id)) {
    console.error(`
Usage: jira [issue-id] [summary], where issue id must be number

given: '${chalk.yellow(id)}'
`);
    process.exit(0);
  }

  try {
    const res = await api.get(`/issue/SB-${id}`);
    const issue = res.data;
    await api.put(`/issue/SB-${id}`, {
      fields: {
        summary,
      }
    });
    printer.updateIssueSummary(issue, summary);
    process.exit(0);
  } catch (e) {
    if (R.path(["response", "status"], e)) {
      const { response: res } = e;
      console.error(res.status, R.path(["data", "errorMessages", "0"], res));
    } else {
      console.error(e);
    }
  }
};
/********************************************************************************************************
 * REST API wrapper end
 */

/**
 * JSON printer
 */
const jsonPrinter = {
  issues: (issues: Issue[]) => {
    const refined = issues.reduce((acc, issue) => {
      const {
        key,
        fields: {
          summary,
          assignee: {
            name,
          },
          status: {
            name: statusKey,
          },
        }
      } = issue;
      return { ...acc, [key.replace("SB-", "")]: { summary, name, statusKey } };
    }, {});

    console.log(JSON.stringify(refined));
  },
  issueSummary: (issue: Issue) => {
    const {
      fields: {
        summary,
      }
    } = issue;
    console.log(summary.replace(/^\[.+\]/, "").trim());
  }
};



/**
 * Pretty printer
 */
const printer = {
  issue: (issue: Issue) => {
    const {
      key,
      fields: {
        summary,
        assignee,
        status: {
          name: statusKey,
        },
      }
    } = issue;

    const name = assignee ? assignee.name : "      ";
    console.log(key, printer.name(name), printer.status((statusMap as any)[statusKey]), summary);
  },
  updateIssueSummary: (issue: Issue, newSummary: string) => {
    const {
      key,
      fields: {
        summary,
        assignee,
        status: {
          name: statusKey,
        },
      }
    } = issue;

    const name = assignee ? assignee.name : "      ";
    console.log(key, printer.name(name), printer.status((statusMap as any)[statusKey]), `${chalk.gray(summary)} -> ${newSummary}`);
  },
  updateIssueStatus: (issue: Issue, newStatus: any) => {
    const {
      key,
      fields: {
        summary,
        assignee,
        status: {
          name: statusKey,
        },
      }
    } = issue;

    const name = assignee ? assignee.name : "      ";
    console.log(key, printer.name(name), printer.status((statusMap as any)[statusKey]), "->", printer.status(newStatus), summary);
  },
  status: (s: typeof status[number]) => {
    const color = {
      "todo": "green",
      "doing": "yellow",
      "wait": "grey",
      "review": "blue",
      "done": "red",
    };
    return chalk[color[s]](s.padStart(STATUS_PAD));
  },
  name: (s: any) => {
    return chalk.white(s.padStart(USER_PAD));
  },
};




/**
 * jira ls 커맨드
 */
const list = async (...args: any) => {
  const options = args.splice(0, args.length - 1);

  // sanitize arguments
  options.forEach((x: any) => {
    if (!status.includes(x) && !users.includes(x)) {
      console.log(`Given argument '${chalk.yellow(x)}' cannot be included in any of
- users : ${users.join(", ")}
- status: ${status.join(", ")}
`);
      process.exit(0);
    }
  });

  try {
    const issues = await getIssueBySprint(...options);
    if (args[args.length - 1].json) {
      jsonPrinter.issues(issues);
    } else {
      issues.forEach(printer.issue);
    }

  } catch (e) {
    if (R.path(["response", "status"], e)) {
      const { response: res } = e;
      console.error(res.status, R.path(["data", "errorMessages", "0"], res));
    } else {
      console.error(e);
    }
  }
};

/**
 * jira <issue-id> summary 커맨드
 */
const change = (to: typeof status[number]) => async (...args: any) => {
  const id = args[0];
  if (!/^\d+$/.test(id)) {
    console.error(`
Usage: jira ${to} <issue-id>, where issue id must be number

given: '${chalk.yellow(id)}'
`);

    process.exit(0);
  }
  try {
    const res = await api.get(`/issue/SB-${id}`);
    const issue = res.data;

    await api.post(`/issue/SB-${id}/transitions`, {
      transition: {
        id: String(statusId[status.indexOf(to)]),
      }
    });
    printer.updateIssueStatus(issue, to);
  } catch (e) {
    if (R.path(["response", "status"], e)) {
      const { response: res } = e;
      console.error(res.status, R.path(["data", "errorMessages", "0"], res));
    } else {
      console.error(e);
    }
  }
};

/**
 * jira add [user] summary 커맨드
 */
const add = async (user: any, ...rest: any) => {
  if (!users.includes(user)) {
    console.log(`First argument must be one of the users: ${users.join(", ")}`);
    console.log(`- given ${chalk.yellow(user)}`);
    process.exit(0);
  }
  const options = rest.filter((x: any) => typeof x === "string");
  if (options.length < 1) {
    console.error("You must specify summary of a issue");
    process.exit(0);
  }
  const summary = options.join(" ");
  const isCopyClipboard = !!rest[rest.length - 1]?.copy;

  try {
    const res = await api.post("issue", {
      fields: {
        project: {
          id: "10016" // TODO, refactor to config
        },
        summary,
        issuetype: {
          id: "10021" // TODO, refactor to config
        },
        assignee: {
          name: user,
        },
        reporter: {
          name: "karl" // TODO, config
        }
      }
    });
    console.log("Issue is successfully created");
    const key = R.path(["data", "key"], res);
    if (key) {
      const sprint = await getActiveSprint();
      console.log("Set the issue's sprint..", sprint.id);
      await api2.post(`sprint/${sprint.id}/issue`, {
        issues: [key],
      });
      if (isCopyClipboard) writeSync((key as string).replace("SB-", ""));

      printer.issue({
        key,
        fields: {
          summary,
          assignee: { name: user },
          status: {
            name: "To Do",
          }
        }
      } as any);
    } else {
      throw new Error("Issue creation failed");
    }
  } catch (e) {
    console.log(e);
  }
};

/**
 * jira rm <issue-id> 커맨드
 */
const remove = async (id: any) => {
  if (!/^\d+$/.test(id)) {
    console.error(`
Usage: jira rm <issue-id>, where issue id must be number

given: '${chalk.yellow(id)}'
`);
  }
  try {
    const issue = await getIssue(id);

    printer.issue(issue);
    inquirer.prompt({
      type: "confirm",
      message: `Delete SB-${id}`,
      name: "yes"
    }).then(async ({ yes }: any) => {
      if (yes) {
        await api.delete(`issue/SB-${id}`);
      } else {
        console.log("Bye..");
      }
    });

  } catch (e) {
    console.log(e);
  }
};

/**
 * jira show <issue-id> 커맨드
 */
const show = async (id: any, ...rest: any) => {
  if (!/^\d+$/.test(id)) {
    console.error(`
Usage: jira rm <issue-id>, where issue id must be number

given: '${chalk.yellow(id)}'
`);
  }

  const isShowSummaryOnly = !!rest[rest.length - 1]?.summary;
  try {
    const issue = await getIssue(id);
    if (isShowSummaryOnly) {
      jsonPrinter.issueSummary(issue);
    } else {
      printer.issue(issue);
    }
  } catch (e) {
    console.log(e);
  }
};


/**
 * CLI entry
 */
program
  .version(version, "-v, --version")
  .command("ls")
  .option("-j, --json", "Print in json")
  .description("list issues")
  .action(list);

program
  .command("add [user] [...rest]")
  .option("-c, --copy", "Copy sprint key to system clipboard")
  .description("Add a issue into current sprint")
  .action(add);

program
  .command("rm [issue]")
  .description("Delete a issue")
  .action(remove);

program
  .command("done [issue]")
  .description("Set status of the issue 'done'")
  .action(change("done"));

program
  .command("wait [issue]")
  .description("Set status of the issue 'wait'")
  .action(change("wait"));

program
  .command("doing [issue]")
  .description("Set status of the issue 'doing'")
  .action(change("doing"));

program
  .command("review [issue]")
  .description("Set status of the issue 'review'")
  .action(change("review"));

program
  .command("todo [issue]")
  .description("Set status of the issue 'todo'")
  .action(change("todo"));

program
  .command("show [issue]")
  .option("-s, --summary", "Print summary only")
  .description("Print status of the issue")
  .action(show);

program
  .arguments("<id> [summary]")
  .description("Update issue summary")
  .action(function(...args) {
    updateIssueSummary(args);
  });

program.on("--help", function() {
  console.log("  [id] [summary] Update summary of issue ");
  console.log("\n");
  console.log("Schema:");
  console.log(`  - users : ${users.join(", ")}`);
  console.log(`  - status: ${status.join(", ")}`);
  console.log("\n");
  console.log("Examples:");
  console.log("  $ jira --help");
  console.log("  $ jira ls");
  console.log("  $ jira ls todo");
  console.log("  $ jira ls joseph");
  console.log("  $ jira ls joseph todo");
  console.log("  $ jira ls karl review done");
  console.log("  $ jira ls jospeh karl doing review");
  console.log(`  $ jira 2356 "(1.5h) ..."`);
  console.log("\n");
});

program.parse(process.argv);
