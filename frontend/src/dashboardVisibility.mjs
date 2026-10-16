export const isDashboardHidden = (assignment) =>
  assignment.dashboard_hidden === true || assignment.dashboard_hidden === 1;

export const isDashboardVisible = (assignment, now) =>
  !isDashboardHidden(assignment) && (!assignment.due || assignment.due >= now);
