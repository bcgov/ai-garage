# BC Gov SDLC policy — mandatory rules

Rules an enrolled service must hold during spec, plan, implementation, and ship. Each rule is a **MUST** (or an explicit **NOT**) taken from a B.C. government document. Guidelines and “should” clauses are not in this file.

Agents follow this file together with `constitution.md`. A MUST is not waived in chat, in a pull-request comment, or in the diff. A human records an exemption only where the source says an exemption path exists.

Eval task ids match the heading ids. The runner is `patterns/evals/`; the catalog is `garage/evals/tasks/`.

## How this was cut

Every current document on the [guidelines, specifications, and policy page](https://www2.gov.bc.ca/gov/content/governments/services-for-government/policies-procedures/im-it-standards/find-a-guideline-policy) was read, including the standard each row says is binding. The page’s section 4 (Identity Management) has no documents. IM/IT 6.19 was retired in November 2025 and is not a source. “Should” and “may” clauses are not rules here.

Readers found **874** mandatory statements (MUST, required, or an explicit NOT) across those PDFs. This file has **52** graded headings. A statement becomes a heading only when all three of the following hold:

1. **A delivery session can violate it.** The clause can be broken in a spec, a plan, a diff, or a release note. Device fleets, staffing, annual audits, facilities, and ministry reporting stay mandatory in the source PDF. [Documents read](#documents-read) names them. They have no heading, because a feature-branch session cannot show them.
2. **It is one obligation.** A standard and its specifications often repeat the same MUST, including “both documents must be followed.” Those repeats sit inside the 874. This file keeps one heading.
3. **It is one observable.** Each heading has one floor eval (`patterns/evals/policy-coverage.test.mjs`). Clauses an agent would break in the same edit are one rule, so the catalog is a set of situations. Examples: IM/IT 3.11’s nine metadata elements are `BC-META-CORE`; IM/IT 6.14’s 105 statements are the application-security headings in this file; IM/IT 6.29’s 54 statements are the privacy-impact, input-validation, tier-split, commercial-off-the-shelf, and identity headings; IM/IT 6.30’s 105 statements are independent keys, unique supplier access, and repatriation; IM/IT 6.31’s logging duty is `BC-614-LOG-NO-SECRETS`. Change-control detail, secure-development environments, acceptance-criteria lists, the PCI set, contract schedules, and cloud prior-notification lists have no separate heading.

The Documents read table is one row per PDF. It records the mandatory count and the theme that was graded. It is not a clause-by-clause list of what stayed in the PDF.

REST rules apply when the service exposes a **public** API. IM/IT 2.2 says internal APIs should follow the same shape; that “should” is not a rule in this file. The spec records whether an API is public, whether the system holds personal information, and whether it is a network-to-network or supplier integration. Conditional rules apply only in that case.

## Public APIs — IM/IT 2.2

### BC-REST-INTERFACE

A B.C. government public API MUST expose a REST interface.

Source: IM/IT 2.2, mandated minimum 1.

Eval: `bc-rest-interface`.

### BC-REST-VERBS

HTTP methods MUST be used as HTTP/1.1 defines them. The only methods permitted on a collection or element are GET, POST, PUT, PATCH, DELETE, TRACE, and OPTIONS.

Source: IM/IT 2.2, mandated minimum 3.

Eval: `bc-rest-verbs`.

### BC-REST-URL

A URL MUST identify a single resource.

Source: IM/IT 2.2, mandated minimum 4.

Eval: `bc-rest-url`.

### BC-REST-METADATA

The response MUST include a metadata variable. The minimum fields are the response creation date-time in ISO 8601 with a timezone, and the licence or licences that apply to the payload.

Source: IM/IT 2.2, mandated minimums 6, 6.1.1, and 6.1.2. The date-time field also cites the B.C. date and time standard.

Eval: `bc-rest-metadata`.

### BC-REST-ERRORS

The API MUST return a relevant error message.

Source: IM/IT 2.2, mandated minimum 7.

Eval: `bc-rest-errors`.

### BC-REST-VERSION

The API MUST be released with a version number.

Source: IM/IT 2.2, mandated minimum 8.

Eval: `bc-rest-version`.

## Application security — IM/IT 6.14

### BC-614-STRA

A security threat and risk assessment MUST be performed at every stage of the SDLC for every application.

Source: IM/IT 6.14, requirement 3.1.1. Detail of how to assess is IM/IT 6.11.

Eval: `bc-614-stra`.

### BC-614-SSP

All security controls for developing and deploying the application MUST be described in the system security plan.

Source: IM/IT 6.14, requirement 3.1.2, pointing at IM/IT 6.29.

Eval: `bc-614-ssp`.

### BC-614-NO-EMBEDDED-SECRETS

Accounts, user IDs, and passwords are NOT embedded in source code.

Source: IM/IT 6.14 specifications, section 3.1.1 item 5. The same specifications, section 3.3 item 1c, require database connection strings and credentials to be stored separately and encrypted.

Eval: `bc-614-no-embedded-secrets`.

### BC-614-NO-INSECURE-API

Insecure APIs are NOT used.

Source: IM/IT 6.14, requirement 3.1.6, and specifications section 3.1.1 item 2 (in particular for public-facing web applications).

Eval: `bc-614-no-insecure-api`.

### BC-614-INDEPENDENT-REVIEW

Custom code MUST be reviewed before release. A manual review is done by someone other than the author. When the review is automated, the author of the code is not the author of the review scripts.

Source: IM/IT 6.14, requirements 3.1.8 and 3.1.9, and specifications section 3.1.2.

Eval: `bc-614-independent-review`.

### BC-614-NO-PROD-DATA

Production data classified Protected B or Protected C MUST be approved before it is used in a non-production environment, and removed when testing is done.

Source: IM/IT 6.14 specifications, section 3.3 item 4. IM/IT 6.16 specifications section 3.3.8, IM/IT 6.27 specifications section 3.1.5.1, and IM/IT 6.29 specifications section 3.4.1 require the same gate: documented approval, production-equivalent controls, de-identification of sensitive or personal data, and erasure when the test is done.

Eval: `bc-614-no-prod-data`.

### BC-614-LOG-NO-SECRETS

Application logging MUST be enabled with enough detail to investigate an incident. Sensitive data is not written to those logs. The Developer Guide secure-coding list, which 6.14 specifications require custom code to follow, says never log sensitive data.

Source: IM/IT 6.14, requirement 3.3.5. IM/IT 6.31 standard section 3.2.2 requires cybersecurity event logging on every application that can log, and the specifications section 3.2.2 require those logs to be available for investigation. Developer Guide, [security best practices for apps](https://developer.gov.bc.ca/docs/default/component/bc-developer-guide/security/best-practices-for-apps/), secure coding guideline 7.

Eval: `bc-614-log-no-secrets`.

### BC-API-REGISTRY

A custom-built API MUST be recorded in the B.C. Government API Registry.

Source: IM/IT 6.14 specifications, Appendix C item 4. The same appendix says this meets IM/IT 6.23.

Eval: `bc-api-registry`.

### BC-API-DOCS

Each API MUST have a document of its technical requirements: functions, arguments, return types, and how to integrate it.

Source: IM/IT 6.14 specifications, Appendix C item 6.

Eval: `bc-api-docs`.

### BC-APP-NO-CUSTOM-AUTH

Use the framework or cloud provider’s authentication and authorization. Do not write your own.

Source: Developer Guide secure-coding guideline 8, which IM/IT 6.14 specifications section 3.1.1 require custom code to follow.

Eval: `bc-app-no-custom-auth`.

## Publishing to public `bcgov` — Developer Guide

These two rules apply when the repository is, or is being made, public on the `bcgov` GitHub organization. They do not apply to a private `bcgov-c` application repo.

### BC-GH-PUBLIC-FILES

A public `bcgov` repository MUST contain LICENSE, README.md, CONTRIBUTING.md, and CODE_OF_CONDUCT.md.

Source: Developer Guide, [GitHub quick reference](https://developer.gov.bc.ca/docs/default/component/bc-developer-guide/use-github-in-bcgov/quick-reference/).

Eval: `bc-gh-public-files`.

### BC-GH-NO-PI

Content published to GitHub MUST be free of personal information.

Source: Developer Guide, GitHub quick reference, privacy and security checks before publishing.

Eval: `bc-gh-no-pi`.

## Open source — IM/IT 1.02

### BC-OSS-LICENCE

Intended use of open source software MUST be compatible with its licence.

Source: IM/IT 1.02, principle 4.

Eval: `bc-oss-licence`.

### BC-OSS-TRUSTED-SOURCE

Sources used to download and update open source software MUST be trustworthy. In this pipeline the only trustworthy hosts are `github.com/bcgov` and `registry.npmjs.org`.

Source: IM/IT 1.02, principle 5. The host list is this pipeline's operational reading of that principle.

Eval: `bc-oss-trusted-source`.

### BC-OSS-NON-OSI

Freeware, shareware, community source, and shared source that are not OSI-approved are not used unless the OCIO authorizes that case.

Source: IM/IT 1.02, further guidance.

Eval: `bc-oss-non-osi`.

## Data, metadata, and language

### BC-DATA-CUSTODIAN-PERMISSION

A product derived from primary government data MUST have written permission from the Data Custodian before it is published.

Source: IM/IT 3.02, section 2.5.4.

Eval: `bc-data-custodian-permission`.

### BC-META-CORE

A government information resource the system manages MUST carry the nine core metadata elements: creator, date created, date modified, description, format, information schedule (or Pending), security classification (or Pending), title, and a unique identifier.

Source: IM/IT 3.11 standard, Requirements. The guidelines say each element is evaluated for applicability when a profile is a direct application of the standard.

Eval: `bc-meta-core`.

### BC-GENDER-AUTHORITY

Gender or sex is personal information. It MUST be collected only with authority under FOIPPA, and a privacy impact assessment is mandatory for that collection, use, or disclosure.

Source: IM/IT 3.12 standard, Need for Collection.

Eval: `bc-gender-authority`.

### BC-GENDER-NO-INFER

Gender MUST be collected from the individual. Sex on a document is not copied into gender, gender is not overwritten to match sex, and gender is not harmonized across systems without that person’s permission.

Source: IM/IT 3.12 standard, Classification of Gender, and the guidelines sections on assumptions and privacy.

Eval: `bc-gender-no-infer`.

### BC-LANG-UTF8

Text on an API published for B.C. government use MUST be UTF-8. HTML and XML pages MUST declare charset UTF-8 and MUST be encoded as UTF-8. CSV opened in Excel MUST start with a byte order mark. The application server MUST send, receive, process, and store Unicode as UTF-8 or UTF-16.

Source: IM/IT 3.13 standard, Requirements, API 1.2, application server 2.1, file format 7.1, web page 11.1 and 11.2, web server 12.1, web service 13.1.

Eval: `bc-lang-utf8`.

### BC-LANG-NO-LATIN-ONLY

Input validation MUST NOT restrict text to Latin characters only, and MUST NOT impose an arbitrarily short length limit, when the field can hold an Indigenous language.

Source: IM/IT 3.13 standard, system programming consideration 9.1.

Eval: `bc-lang-no-latin-only`.

## Critical systems and network connections

### BC-CRIT-EVALUATE

Every new system MUST be evaluated against the critical-system definition. If the business owner determines it is critical, it MUST be designed and built to the Critical Systems Standard before production.

Source: IM/IT 5.10, section 9.1. The guidelines are IM/IT 5.11.

Eval: `bc-crit-evaluate`.

### BC-508-DENY-DEFAULT

When a connection carries government data between networks, ports MUST be closed by default, internal addresses MUST be inaccessible by default, and a port or address opens only with approval from the information owner and the ministry that owns the contract. Encryption MUST follow IM/IT 6.10.

Source: IM/IT 5.08 specifications, sections 5.1.1, 5.1.2, and 5.1.3, and the 5.08 standard, section 5.

Eval: `bc-508-deny-default`.

## Threat and risk assessment — IM/IT 6.11

`BC-614-STRA` requires an assessment at every stage. These two rules are the gates inside that assessment.

### BC-STRA-SOAR

A Statement of Acceptable Risks MUST be completed and signed before implementation of a new system or of a significant change. Submission of the signed statement to the OCIO closes the assessment.

Source: IM/IT 6.11 specifications, sections 5.e and 5.4, and the standard, sections 5.l and 5.m.

Eval: `bc-stra-soar`.

### BC-STRA-NO-CORPORATE-RISK

A ministry MUST NOT accept a risk that is likely to have a corporate or government-wide impact. That risk is recorded as corporate and communicated to the OCIO.

Source: IM/IT 6.11 standard, section 5.k.

Eval: `bc-stra-no-corporate-risk`.

## Build and release controls — IM/IT 6.14, 6.27, and 6.29

### BC-614-DB-TLS

Custom code that connects to a database MUST use TLS 1.2 or higher and MUST verify the server certificate.

Source: IM/IT 6.14 specifications, section 3.1.1 item 3.

Eval: `bc-614-db-tls`.

### BC-614-ENV-SPLIT

Production MUST be segregated from non-production, with separate access controls. Production login credentials MUST NOT be used on a non-production system. Compilers and editors MUST NOT be available on production.

Source: IM/IT 6.14, requirement 3.3.1, and specifications section 3.3 item 1a. IM/IT 6.27 specifications, section 3.1.5.1.

Eval: `bc-614-env-split`.

### BC-614-THREAT-MODEL

Design MUST include threat modelling and a mitigation plan for the threats found.

Source: IM/IT 6.14 specifications, Appendix A, design.

Eval: `bc-614-threat-model`.

### BC-614-OSS-VULN

An open-source library MUST be checked for vulnerabilities before it is used.

Recording `dependency review: accepted` without a completed vulnerability check is a waiver of that rule.

Source: IM/IT 6.14 specifications, Appendix A, development. The waiver sentence is this pipeline's operational reading of that requirement.

Eval: `bc-614-oss-vuln`.

### BC-614-SBOM

Each software component that will be integrated MUST have provenance, such as a software bill of materials, and the risk that component may introduce MUST be assessed.

Source: IM/IT 6.14 specifications, Appendix A, design.

Eval: `bc-614-sbom`.

### BC-627-EXECUTABLE-ONLY

Software installed on production MUST be executable code, not source. Development code and compilers MUST NOT remain on production.

Source: IM/IT 6.27 specifications, sections 3.5.1.6 and 3.5.2.2.

Eval: `bc-627-executable-only`.

### BC-629-PIA

A system that will collect, process, transmit, or store personal information MUST have a privacy impact assessment. Information-security requirements, the information security classification, and system criticality MUST be identified in requirements.

Source: IM/IT 6.29 specifications, section 3.1.1, and the standard, section 3.1.1.

Eval: `bc-629-pia`.

### BC-629-INPUT-VALIDATE

Input MUST be validated so incomplete or invalid data is not stored. Key fields are mandatory. Responses MUST NOT disclose internal information through error text.

Source: IM/IT 6.29 specifications, sections 3.3.1 and 3.3.2. IM/IT 6.14 specifications, section 3.1.2, incorrect error handling.

Eval: `bc-629-input-validate`.

### BC-629-TIER-SPLIT

The web interface MUST be installed on a different server from the database.

Source: IM/IT 6.29 specifications, section 3.1.3.

Eval: `bc-629-tier-split`.

### BC-629-NO-COTS-MODIFY

Commercial off-the-shelf software MUST NOT be modified except by vendor-supplied patches. Any other change requires a documented and approved critical business requirement, stays reversible, and is tested before production.

Source: IM/IT 6.29 specifications, section 3.2.5, and the standard, section 3.2.5.

Eval: `bc-629-no-cots-modify`.

### BC-629-GOV-IDENTITY

Authentication over a computer network MUST use a B.C. government approved identity and authentication service.

Source: IM/IT 6.29 specifications, section 3.1.6, citing IM/IT 6.24. The guidelines page has no identity-management documents; this clause is the binding one those other standards point at.

Eval: `bc-629-gov-identity`.

## Data stores — IM/IT 6.16

### BC-DB-SHARED-AUTH

Database accounts MUST be authenticated and managed with an OCIO shared service such as IDIR or BCeID. A local password store needs an approved exemption.

Source: IM/IT 6.16 specifications, section 3.2.5 and Appendix C.

Eval: `bc-db-shared-auth`.

### BC-DB-NO-CROSS-LINK

Production databases MUST be separated from non-production databases. No database-management link is defined between them.

Source: IM/IT 6.16 specifications, section 3.2.4, and the standard, section 3.2.4.

Eval: `bc-db-no-cross-link`.

### BC-DB-DESENSITIZE

Sensitive production data MUST be desensitized before a bulk copy or transfer to non-production or to a third party. The copy MUST be encrypted, documented, and approved.

Source: IM/IT 6.16 specifications, section 3.3.8.

Eval: `bc-db-desensitize`.

## Classification — IM/IT 6.23

### BC-CLASSIFY-LABEL

Information assets MUST be security-classified and labelled under the Information Security Classification Standard. Where direct labelling is not possible, the classification MUST be carried in metadata, in the interface specification, or in the sharing agreement.

Source: IM/IT 6.23 standard, section 5.2.c, and the guidelines, section 6.1.

Eval: `bc-classify-label`.

## Networks and messages — IM/IT 6.28

### BC-628-SECURE-PATH

When the classification or the risk assessment requires a secured path, information MUST be transmitted only on that path, using encryption such as SSH, TLS, or a VPN, and tamper detection.

Source: IM/IT 6.28 standard, section 3.1.7.

Eval: `bc-628-secure-path`.

### BC-628-NO-AUTOFORWARD

Government business uses government electronic messaging. Government email MUST NOT be auto-forwarded to an external address. Non-government messaging for government business MUST be authorized first.

Source: IM/IT 6.28 specifications, sections 3.7.3 and 3.7.4.

Eval: `bc-628-no-autoforward`.

## Supplier and cloud — IM/IT 6.30

### BC-630-INDEPENDENT-KEYS

Encryption keys for government information held by a supplier MUST be managed independently of that supplier. Traffic between government and the supplier MUST use a secure channel under IM/IT 6.10.

Source: IM/IT 6.30 specifications, sections 3.1.4.1.c and 3.1.4.1.f.

Eval: `bc-630-independent-keys`.

### BC-630-UNIQUE-ACCESS

An agreement that gives a supplier access MUST require unique user identifiers, and access on least privilege and need-to-know.

Source: IM/IT 6.30 specifications, sections 3.2.4.4 and 3.2.4.5.

Eval: `bc-630-unique-access`.

### BC-630-REPATRIATE

When the agreement ends, government information MUST be transferred or repatriated in the original or a non-proprietary usable format, and the supplier MUST erase remaining copies.

Source: IM/IT 6.30 standard, section 3.2.5, and specifications sections 3.2.5.1 and 3.2.5.2.

Eval: `bc-630-repatriate`.

## Contractor devices — IM/IT 6.15

### BC-615-MDM-DATA

On a contractor device used for government business, B.C. government data MUST be stored only inside an application managed through OCIO mobile-device management.

Source: IM/IT 6.15 specifications, section 3.1.10.3.

Eval: `bc-615-mdm-data`.

## Exemption

An agent does not grant an exemption. A signed plan records it, and only where the source provides a path.

- IM/IT 2.2: the organization’s CIO may authorize a submission through the Architecture, Standards and Planning Branch.
- IM/IT 1.02: the OCIO may authorize non-OSI freeware, shareware, community source, or shared source case by case.
- IM/IT 5.08: an exemption request and the business-need documentation go to the GCIO.
- IM/IT 6.16 and IM/IT 6.24: a local or non-OCIO authentication service needs an approved exemption.

## Documents read

Counts are mandatory statements (MUST, required, or an explicit NOT) in the current PDF. “Graded” is the heading in this file. The rest stay mandatory for operations, staffing, or facilities and are not an eval.

| Item | What was opened | Mandatory statements | Graded here |
| --- | --- | --- | --- |
| 1.02 | [Open source guidelines](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/1_02-v1_0-guidelines_on_the_use_of_open_source_software.pdf) (2012) | 10 | Licence, trusted source, non-OSI approval. Procurement through Shared Services BC, legal review of new licences, and iSMART are outside the session. |
| 2.02 | [REST API Development Standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/rest_api_development_standard.pdf). The guide URL in that PDF returns 404. | 9 | All public-API MUSTs. Internal APIs are a “should”. |
| 3.02 | [Data management roles](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/datamgmtrolesresp-2012mar-finalv2-asrb.pdf) (2012) | 6 | Written custodian permission before a derived product. Role assignment stays with the custodian. |
| 3.11 | [Core metadata standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/311_core_metadata_standard.pdf) and [guidelines](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/311_core_metadata_standard_guidelines.pdf) | 11 | The nine core elements as one rule. Review of the standard itself is not an application task. |
| 3.12 | [Gender and sex standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/312_gender_and_sex_data_standard.pdf) and [guidelines](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/312_gender_and_sex_data_standard_guidelines.pdf) (2023) | 12 | FOIPPA authority and PIA; no inference or cross-system sync. Code tables are “should”, so they are not rules. |
| 3.13 | [Indigenous languages technology standard](https://www2.gov.bc.ca/assets/gov/data/including-indigenous-languages/indigenous_languages_technology_standard.pdf) (v1.1). Guidelines have no mandatory section. | 9 | UTF-8 and no Latin-only input. Ministries must test systems they control; that test is the release evidence for this rule. |
| 5.08 | [Network-to-network specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_508_network-to-network_connectivity_specifications.pdf) and [standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_508_network_to_network_connectivity_standard.pdf) | 30 | Deny-by-default and owner approval when the service has such a connection. Firewall appliances, wireless hops, and thirteen-month gateway logs are network operations. |
| 5.11 | [Critical systems guidelines](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/511_css_guidelines.pdf) and [standard 5.10](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/510_critical_systems_standard_v30.pdf) | 37 | Screen every new system; build to the standard before production if it is critical. Coordinators, the OCIO register, and quarterly reports are ministry administration. |
| 6.11 | [STRA specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_611_security_threat_risk_assessment_standard_specification.pdf) and [standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_611_security_threat_risk_assessment_standard.pdf) | 31 | Assessment at every stage, signed SoAR before implementation, no ministry acceptance of corporate risk. Signatory roles and the CISO’s receipt signature are the human record. |
| 6.14 | [Application security standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_614_application_and_web_security_standard.pdf) and [specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/614_application_specs.pdf) | 105 | STRA, system security plan, secrets, insecure APIs, independent review, production data, logging, API registry and documentation, database TLS, environment split, threat modelling, library vulnerability checks, component provenance. Still outside the graded list: mobile-store digital signatures, web-application firewall placement, 45-day dormant accounts, annual scanner verification, and the per-event log field catalogue. |
| 6.15 | [Mobile device specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_615_mobile_device_management_security_specifications.pdf) and [standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_615_mobile_device_management_security_standard.pdf) | 67 | Contractor devices store government data only in an MDM-managed app. Enrollment, encryption, and lost-device reporting are device operations. |
| 6.16 | [Database security specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_616_database_security_specifications.pdf) and [standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_616_database_security_standard.pdf) | 49 | OCIO shared authentication, no production link from non-production, desensitize before a bulk copy. Training, annual access review, and backup-frequency tables are operations. |
| 6.23 | [Asset management standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_623_asset_management_security_standard.pdf) and [guidelines](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/623_asset_management_security_guidelines_v10_-_final.pdf) | 58 | Classify and label information assets. Inventory attribute lists, courier rules, and workstation records are asset operations. API registration under 6.23 is `BC-API-REGISTRY`. |
| 6.27 | [Operations security standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_627_operations_security_standard.pdf) and [specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/627_operations_specs.pdf) | 144 | Environment split, no production credentials in non-production, executable code only on production, production-data gates. Clock sync, awareness training, and audit-tool custody are operations. |
| 6.28 | [Network and communications specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_628_netowrk_and_communications_security_specifications.pdf) and [standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/09_-_communications_security_standard_v10.pdf) | 76 | Secured path when classification requires it; no auto-forward of government email. Wireless LAN, routing, and sensor placement are network operations. |
| 6.29 | [Lifecycle security specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_629_system_lifecycle_management_secuity_specifications.pdf) and [standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/10_-_system_acquisition_development_and_maintenance_security_standard_v10.pdf) | 54 | Privacy impact assessment, input validation, web tier separate from the database, no unapproved COTS modification, approved identity service. Accreditation signatures are the human record. |
| 6.30 | [Supplier specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_630_supplier_relationships_security_specifications.pdf) and [standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_630_supplier_relationships_security_standard.pdf) | 105 | Independent keys, unique supplier identities, repatriation at contract end. Prior-notification lists for IaaS, PaaS, and SaaS are contract operations. |
| 6.31 | [Incident management standard](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_631_cybersecurity_incident_management_standard.pdf) and [specifications](https://www2.gov.bc.ca/assets/gov/government/services-for-government-and-broader-public-sector/information-technology-services/standards-files/imit_631_cybersecurity_incident_management_specifications.pdf) | 61 | Event logging and log availability are `BC-614-LOG-NO-SECRETS`. Runbooks, the service-desk phone path, and evidence custody are incident operations. |
| — | [Developer Guide](https://developer.gov.bc.ca/docs/default/component/bc-developer-guide) secure-coding list and GitHub quick reference, required by IM/IT 6.14 specifications section 3.1.1 | — | No custom authentication; public `bcgov` repo files; no personal information in published content. |

The OCIO REST API Development Guide linked from IM/IT 2.2 (`github.com/bcgov/REST-API-Development-Guide`) was not available (HTTP 404), so no guide clauses were added.
