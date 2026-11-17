import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ConsultationIntakeForm,
  EVENT_OCCASIONS,
  INITIAL_INTAKE_FORM,
  OTHER_OCCASION,
  validateIntakeForm,
} from "../ConsultationIntakeForm";

const html = renderToStaticMarkup(
  createElement(ConsultationIntakeForm, {
    selectedSlot: {
      id: "00000000-0000-4000-8000-000000000000",
      startTime: "2026-12-20T11:30:00.000Z",
      endTime: "2026-12-20T12:30:00.000Z",
    },
    onReservationSuccess: () => {},
    onBack: () => {},
  })
);
const occasionSelect = html.match(/<select[^>]*id="eventType"[^>]*>([\s\S]*?)<\/select>/);

// A form a customer has filled in correctly, apart from the field under test.
const completed = (eventType: string, eventTypeOther = "") => ({
  ...INITIAL_INTAKE_FORM,
  customerFirstName: "Asha",
  customerLastName: "Rao",
  customerPhone: "9876543210",
  customerEmail: "asha@example.com",
  customerCity: "Delhi",
  eventType,
  eventTypeOther,
});

describe("consultation occasion selector", () => {
  it("starts with no occasion selected", () => {
    expect(INITIAL_INTAKE_FORM.eventType).toBe("");
  });

  it("shows the placeholder as the selected option and marks the field required", () => {
    expect(occasionSelect).not.toBeNull();
    const [selectTag, options] = [occasionSelect![0], occasionSelect![1]];
    expect(selectTag).toMatch(/\brequired=""/);
    expect(options).toMatch(/<option value="" disabled="" selected="">Select your celebration occasion<\/option>/);
  });

  it("does not preselect Diwali (or any real occasion)", () => {
    const selected = [...occasionSelect![1].matchAll(/<option[^>]*selected=""[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(selected).toEqual(["Select your celebration occasion"]);
  });

  it("offers Christmas, keeps Diwali available and ends with Other", () => {
    const values = EVENT_OCCASIONS.map((o) => o.value);
    expect(values).toContain("Christmas Celebration");
    expect(values).toContain("Diwali Celebration Gala");
    expect(values.at(-1)).toBe(OTHER_OCCASION);
    expect(values.every((v) => v.length <= 50)).toBe(true); // server limit
  });

  it("keeps every previously stored occasion value, so historical data stays consistent", () => {
    const values = EVENT_OCCASIONS.map((o) => o.value);
    for (const original of [
      "Diwali Celebration Gala",
      "Luxury Wedding / Engagement",
      "Milestone Birthday Celebration",
      "Anniversary Gala",
      "Festive Housewarming / Griha Pravesh",
      "Corporate Milestone Celebration",
      "Other Celebration",
    ]) {
      expect(values).toContain(original);
    }
  });

  it.each([
    ["Luxury Wedding / Engagement", "Wedding / Engagement"],
    ["Milestone Birthday Celebration", "Birthday Celebration"],
    ["Anniversary Gala", "Anniversary Celebration"],
    ["Festive Housewarming / Griha Pravesh", "Housewarming / Griha Pravesh"],
    ["Corporate Milestone Celebration", "Corporate Celebration"],
    ["Christmas Celebration", "Christmas Celebration"],
  ])("renders stored value %j with the label %j", (value, label) => {
    expect(occasionSelect![1]).toContain(`<option value="${value}">${label}</option>`);
  });

  it("hides the 'describe your celebration' input until Other is chosen", () => {
    expect(html).not.toContain('id="eventTypeOther"');
  });
});

describe("consultation occasion validation", () => {
  it("blocks submission when no occasion is selected", () => {
    expect(validateIntakeForm(completed(""))).toEqual({
      eventType: "Please select your celebration occasion.",
    });
  });

  it.each(["Christmas Celebration", "Diwali Celebration Gala", "Luxury Wedding / Engagement"])(
    "accepts an explicitly chosen %s",
    (occasion) => {
      expect(validateIntakeForm(completed(occasion))).toEqual({});
    }
  );

  it("still requires a description for Other Celebration", () => {
    expect(validateIntakeForm(completed(OTHER_OCCASION))).toEqual({
      eventTypeOther: "Please describe your celebration.",
    });
    expect(validateIntakeForm(completed(OTHER_OCCASION, "   "))).toEqual({
      eventTypeOther: "Please describe your celebration.",
    });
    expect(validateIntakeForm(completed(OTHER_OCCASION, "Golden jubilee dinner"))).toEqual({});
  });

  it("keeps the existing contact-field checks", () => {
    const errors = validateIntakeForm(INITIAL_INTAKE_FORM);
    expect(Object.keys(errors).sort()).toEqual(
      ["customerCity", "customerEmail", "customerFirstName", "customerLastName", "customerPhone", "eventType"].sort()
    );
  });
});
