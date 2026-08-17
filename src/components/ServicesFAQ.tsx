"use client";

import { useState } from "react";
import styles from "./ServicesFAQ.module.css";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: "faq-1",
    question:
      "Can I book individual services or do I have to book a full package?",
    answer:
      "You can book individual standalone services (such as decor or catering) or combine multiple services into a coordinated celebration. Please contact Eventsika for details specific to your celebration.",
  },
  {
    id: "faq-2",
    question:
      "How does custom pricing work for larger guest counts or multi-day celebrations?",
    answer:
      "Displayed prices are starting ballpark estimates. For larger guest counts, multi-day functions, or custom themes, we prepare an itemized proposal tailored to your specific requirements.",
  },
  {
    id: "faq-3",
    question: "Can I bring in my own vendors alongside Eventsika services?",
    answer:
      "Yes, we can coordinate alongside your preferred family vendors, specialists, or priest. Please discuss your vendor preferences with our team during consultation.",
  },
  {
    id: "faq-4",
    question: "How early should we book our celebration services?",
    answer:
      "We recommend inquiring as soon as your date or venue is under consideration. Lead times vary depending on service requirements and peak dates. Please contact Eventsika for details specific to your celebration.",
  },
  {
    id: "faq-5",
    question: "What happens if our event date or venue changes after booking?",
    answer:
      "If your date, venue, or schedule changes, notify our team as early as possible. Date transfers and modifications depend on scheduling and vendor coordination. Please contact Eventsika for details specific to your celebration.",
  },
];

export default function ServicesFAQ() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    "faq-1": true,
  });

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-heading">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>HELP &amp; CLARITY</p>
          <h2 id="faq-heading" className={styles.title}>
            Frequently Asked Questions
          </h2>
        </div>

        {/* Accordion List */}
        <div
          className={styles.accordionList}
          role="region"
          aria-label="Frequently Asked Questions"
        >
          {FAQ_DATA.map((item) => {
            const isOpen = Boolean(openItems[item.id]);
            return (
              <div key={item.id} className={styles.accordionItem}>
                <h3 className={styles.headingWrapper}>
                  <button
                    type="button"
                    id={`faq-btn-${item.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${item.id}`}
                    className={styles.questionButton}
                    onClick={() => toggleItem(item.id)}
                  >
                    <span className={styles.questionText}>{item.question}</span>
                    <span
                      className={`${styles.iconWrapper} ${
                        isOpen ? styles.iconOpen : ""
                      }`}
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={styles.icon}
                      >
                        <line
                          x1="12"
                          y1="5"
                          x2="12"
                          y2="19"
                          className={styles.verticalLine}
                        />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-panel-${item.id}`}
                  role="region"
                  aria-labelledby={`faq-btn-${item.id}`}
                  className={`${styles.answerPanel} ${
                    isOpen ? styles.answerPanelOpen : ""
                  }`}
                >
                  <p className={styles.answerText}>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
