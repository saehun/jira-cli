import axios from "axios";
const {
  JIRA_TOKEN,
  JIRA_EMAIL,
  JIRA_PROJECT_KEY,
  JIRA_ENDPOINT,
} = process.env;

const api = axios.create({
  baseURL: JIRA_ENDPOINT + "/api/2",
  timeout: 15000,
  auth: { username: JIRA_EMAIL, password: JIRA_TOKEN },
});

export const getAllUsers = async (): Promise<User[]> => {
  const res = await api.get(`user/assignable/search?project=${JIRA_PROJECT_KEY}`);
  const users = res.data as User[];
  return users.filter((user: User) => user.accountType === "atlassian" && user.key !== "admin");
};
