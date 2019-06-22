import axios from "axios";
import * as R from "ramda";
import * as date from "date-fns";
import * as program from "commander";
import * as inquirer from "inquirer";
const chalk = require("chalk");

console.log("JIRA cli -- v1.0.0");

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


interface User {
  self: string;
  key: string;
  accountId: string;
  accountType: string;
  name: string;
  emailAddress: string;
  avatarUrls: Record<string, string>;
  displayName: string;
  active: boolean;
  timeZone: string;
  locale: string;
}

interface IssueStatus {
  description: string;
  iconUrl: string;
  name: string;
  id: string;
  statusCategory: {
    self: string;
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

interface Issue {
  expand: string;
  id: string;
  self: string;
  key: string;
  fields: {
    summary: string;
    assignee?: User;
    status: IssueStatus;
  };
}

interface Sprint {
  id: number;
  self: string;
  state: string;
  name: string;
  startDate: string;
  endDate: string;
  originBoardId: number;
  goal: string;
}


const getAllSprint = async () => {
  const res = await api2.get(`board/${SPRINT_BOARD_ID}/sprint`);
  return res.data.values;
};

const getSprint = async (offset = 0) => {
  const sprints = await getAllSprint();
  const targetDate = date.addWeeks(new Date(), offset);

  return R.find(
    (sprint: Sprint) =>
      R.propSatisfies((endDate: string) => date.isBefore(targetDate, new Date(endDate)), "endDate")(sprint) &&
      R.propSatisfies((startDate: string) => date.isAfter(targetDate, new Date(startDate)), "startDate")(sprint),
    sprints
  ) as Sprint;
};

// jql=project=anerds%20and%20resolution=Duplicate
const getIssueBySprint = async (offset = 0, ...args: (typeof users[number] | typeof status[number])[]): Promise<Issue[]> => {
  const sprint = await getSprint(offset);

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
    const issues = await getIssueBySprint(0, ...options);
    issues.forEach(printer.issue);

  } catch (e) {
    if (R.path(["response", "status"], e)) {
      const { response: res } = e;
      console.error(res.status, R.path(["data", "errorMessages", "0"], res));
    } else {
      console.error(e);
    }
  }
};

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
      const sprint = await getSprint();
      console.log("Set the issue's sprint..", sprint.id);
      await api2.post(`sprint/${sprint.id}/issue`, {
        issues: [key],
      });

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

program
  .version("0.1.0", "-v, --version")
  .command("ls")
  .description("list issues")
  .action(list);

program
  .command("add [user] [...rest]")
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
