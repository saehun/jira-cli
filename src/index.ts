import axios from "axios";
import * as R from "ramda";
import * as date from "date-fns";
import * as program from "commander";
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

/*
(async () => {
})();
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

program
  .version("0.1.0", "-v, --version")
  .command("ls")
  .description("list issues")
  .action(list);


program.parse(process.argv);

/* example command

jira ls  -> list all issue
jira ls todo
jira ls karl todo done
jira ls jackie karl todo done
jira ls
jira add karl "............"
jira mv <id> <karl done>
jira rm <id>

*/
