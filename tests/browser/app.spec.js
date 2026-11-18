import { test, expect } from "@playwright/test";

async function login(page) {
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue as Mia" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "My circle" }).first(),
  ).toBeVisible();
}
test("discovery, movie search, detail and seat selection use real data", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Casablanca", exact: true }).first(),
  ).toBeVisible();
  // The spotlight switches films, and the ticket beside it follows.
  await page.getByRole("tab", { name: "The Grand Budapest Hotel" }).click();
  await expect(
    page
      .getByRole("heading", { name: "The Grand Budapest Hotel", exact: true })
      .first(),
  ).toBeVisible();
  await expect(page.locator(".admission-copy.current h2")).toHaveText(
    "The Grand Budapest Hotel",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Rear Window" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("link", { name: "Films", exact: true }).first().click();
  await page.getByRole("searchbox", { name: "Search films" }).fill("Spirited");
  await expect(
    page.getByRole("heading", { name: "Spirited Away", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".poster-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: /Spirited Away/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Spirited Away", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Hayao Miyazaki", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write a review", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("signed-in member creates, edits and deletes a review and a private list", async ({
  page,
}) => {
  await page.goto("/films/12");
  await login(page);
  await page
    .getByRole("button", { name: "Write a review", exact: true })
    .click();
  await page.getByLabel("Your rating").fill("0");
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Browser test: a remarkable portrait.");
  await page
    .getByRole("button", { name: "Publish review", exact: true })
    .click();
  await expect(
    page.getByText("Browser test: a remarkable portrait."),
  ).toBeVisible();
  await expect(page.locator(".movie-rating > strong")).toHaveText("0.0");
  await page.getByRole("button", { name: "Edit review", exact: true }).click();
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Browser test: an unforgettable portrait.");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(
    page.getByText("Browser test: an unforgettable portrait."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete review", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByText("Browser test: an unforgettable portrait."),
  ).toHaveCount(0);
  await page.goto("/circle");
  await page.getByRole("tab", { name: /^My lists/ }).click();
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page.getByLabel("List name").fill("Browser test list");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test list", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Film to add").selectOption("12");
  await page.getByRole("button", { name: "Add film", exact: true }).click();
  await expect(page.locator(".list-film")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".list-film")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete list", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page).toHaveURL(/\/circle/);
});
test("booking confirms a server-priced ticket and persists it in history", async ({
  page,
  request,
}) => {
  await page.goto("/screenings/1");
  await login(page);
  await page.getByRole("button", { name: /^Seat B1, standard, HK\$/ }).click();
  await expect(page.getByTestId("booking-total")).toContainText("62.40");
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "You’re going to the movies.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View my tickets", exact: true })
    .click();
  await expect(page.getByText("Seat B1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Seat B1", { exact: true })).toBeVisible();
});
test("mobile pages fit viewport and dialogs support Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/films",
    "/films/1",
    "/cinemas",
    "/screenings/1",
    "/community",
  ]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/mobile-community.png",
    fullPage: true,
  });
});

test("community updates followed members immediately after signing in", async ({
  page,
}) => {
  await page.goto("/community");
  await login(page);
  await expect(
    page.getByRole("button", { name: "Unfollow alex", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Follow noah", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unfollow noah", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unfollow noah", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Unfollow noah", exact: true })
    .click();
});

test("an action started while signed out finishes after signing in", async ({
  page,
}) => {
  await page.goto("/members/3");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await page.getByRole("button", { name: "Continue as Mia" }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Following", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toBeVisible();
});

test("screening filters stay in the address and empty days point to the next showing", async ({
  page,
}) => {
  await page.goto("/cinemas");
  const dates = page.getByRole("group", { name: "Choose screening date" });
  await dates.getByRole("button").nth(1).click();
  await page.getByLabel("Filter screenings by film").selectOption("1");
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}.*movieId=1/);
  const url = page.url();
  await page.reload();
  expect(page.url()).toBe(url);
  await expect(page.getByLabel("Filter screenings by film")).toHaveValue("1");
  const empty = page.getByRole("heading", { name: /^Not showing on / });
  if (await empty.isVisible()) {
    await page.getByRole("button", { name: /^Go to / }).click();
    await expect(page.locator(".screening-row").first()).toBeVisible();
  }
  await page.locator(".time-option").first().click();
  await page.getByRole("link", { name: "All screenings" }).click();
  await expect(page).toHaveURL(/movieId=1/);
});

test("tabs follow the keyboard pattern and long feeds load more", async ({
  page,
}) => {
  await page.goto("/members/2");
  const reviews = page.getByRole("tab", { name: /^Reviews/ });
  await reviews.focus();
  await page.keyboard.press("ArrowRight");
  const lists = page.getByRole("tab", { name: /^Lists/ });
  await expect(lists).toBeFocused();
  await expect(lists).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "aria-labelledby",
    await lists.getAttribute("id"),
  );
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /^Watched/ })).toBeFocused();
  await page.goto("/community");
  const cards = page.locator(".community-layout .review-card");
  const before = await cards.count();
  const more = page.getByRole("button", { name: "Show more reviews" });
  await more.click();
  await expect(cards).not.toHaveCount(before);
  // Keep loading until every review is shown and the button goes away.
  for (let i = 0; i < 5 && (await more.count()); i++) {
    const shown = await cards.count();
    await more.click();
    await expect(cards).not.toHaveCount(shown);
  }
  await expect(more).toHaveCount(0);
});
