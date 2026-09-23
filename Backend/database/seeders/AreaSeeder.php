<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Parameter;
use Illuminate\Database\Seeder;

class AreaSeeder extends Seeder
{
    public function run(): void
    {
        $aaccupAreas = [
            [
                'name' => 'Area I: Vision, Mission, Goals and Objectives',
                'description' => 'Statement of institutional VMGO, dissemination, acceptance, and alignment with academic programs.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Statement of Vision, Mission, Goals and Objectives', 'details' => 'Clearly articulated institutional statements aligned with development goals.'],
                    ['parameter_letter' => 'B', 'name' => 'Dissemination and Acceptability', 'details' => 'Broad dissemination of VMGO to stakeholders and evidence of acceptance.'],
                ],
            ],
            [
                'name' => 'Area II: Faculty',
                'description' => 'Qualifications, recruitment, adequacy, faculty development, loading, and evaluation.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Academic Qualifications & Professional Experience', 'details' => 'Degree credentials aligned with teaching assignments and valid PRC licenses.'],
                    ['parameter_letter' => 'B', 'name' => 'Recruitment, Selection & Orientation', 'details' => 'Merit-based hiring policies, screening procedures, and faculty onboarding.'],
                    ['parameter_letter' => 'C', 'name' => 'Faculty Adequacy & Teaching Loading', 'details' => 'Faculty-student ratios, regular loading, and preparation counts.'],
                    ['parameter_letter' => 'D', 'name' => 'Faculty Development Program', 'details' => 'Institutional support for advanced studies, training, and conferences.'],
                    ['parameter_letter' => 'E', 'name' => 'Faculty Performance Evaluation', 'details' => 'Systematic appraisal of teaching competence and academic productivity.'],
                ],
            ],
            [
                'name' => 'Area III: Curriculum and Instruction',
                'description' => 'Program of study, instructional processes, syllabus design, and learning outcomes.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Curriculum Development & Revision', 'details' => 'Regular curricular review aligned with CHED CMO guidelines.'],
                    ['parameter_letter' => 'B', 'name' => 'Instructional Materials & Syllabi', 'details' => 'OBE syllabi, course modules, textbooks, and multimedia materials.'],
                    ['parameter_letter' => 'C', 'name' => 'Classroom Instruction & Evaluation', 'details' => 'Teaching methodologies, rubrics, and academic performance monitoring.'],
                ],
            ],
            [
                'name' => 'Area IV: Support to Students',
                'description' => 'Admission, scholarships, guidance, student organizations, and health services.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Student Services & Guidance', 'details' => 'Comprehensive guidance counseling and student development programs.'],
                    ['parameter_letter' => 'B', 'name' => 'Scholarships & Student Welfare', 'details' => 'Financial aid, student organizations, and welfare facilities.'],
                ],
            ],
            [
                'name' => 'Area V: Research',
                'description' => 'Institutional research agenda, funding, publications, and patents.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Research Agenda & Management', 'details' => 'Approved institutional research agenda and faculty incentives.'],
                    ['parameter_letter' => 'B', 'name' => 'Research Outputs & Publications', 'details' => 'Peer-reviewed journals, presentations, and applied research.'],
                ],
            ],
            [
                'name' => 'Area VI: Extension and Community Involvement',
                'description' => 'Outreach projects, community partnerships, technology transfer, and impact.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Extension Programs & Linkages', 'details' => 'Sustainable community outreach aligned with institutional expertise.'],
                    ['parameter_letter' => 'B', 'name' => 'Community Engagement & Impact', 'details' => 'Needs assessment and documented impact of extension projects.'],
                ],
            ],
            [
                'name' => 'Area VII: Library',
                'description' => 'Book collection, digital subscriptions, staff, facilities, and automation.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Library Holdings & Resources', 'details' => 'Adequate print titles, journals, e-books, and databases.'],
                    ['parameter_letter' => 'B', 'name' => 'Library Staff & Services', 'details' => 'Professional librarians, automated catalog (OPAC), and reader spaces.'],
                ],
            ],
            [
                'name' => 'Area VIII: Physical Plant and Facilities',
                'description' => 'Campus master plan, classrooms, offices, safety, sanitation, and power.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Campus Classrooms & Buildings', 'details' => 'Well-ventilated, well-lit classrooms and accessible campus buildings.'],
                    ['parameter_letter' => 'B', 'name' => 'Maintenance, Safety & Sanitation', 'details' => 'Disaster risk management, clean sanitation, and campus security.'],
                ],
            ],
            [
                'name' => 'Area IX: Laboratories',
                'description' => 'Specialized labs, equipment maintenance, safety protocols, and manuals.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Laboratory Facilities & Equipment', 'details' => 'Modern lab rooms, computers, simulators, and science apparatus.'],
                    ['parameter_letter' => 'B', 'name' => 'Laboratory Management & Safety', 'details' => 'Lab technician staffing, chemical safety, and equipment logs.'],
                ],
            ],
            [
                'name' => 'Area X: Administration',
                'description' => 'Governance, financial resources, records management, and administrative personnel.',
                'parameters' => [
                    ['parameter_letter' => 'A', 'name' => 'Organization & Governance', 'details' => 'Clear administrative structure, manual of operations, and board policies.'],
                    ['parameter_letter' => 'B', 'name' => 'Financial Management & Records', 'details' => 'Transparent budget allocation, audited statements, and records archiving.'],
                ],
            ],
        ];

        foreach ($aaccupAreas as $areaData) {
            $params = $areaData['parameters'] ?? [];
            unset($areaData['parameters']);

            $existing = Area::where('name', $areaData['name'])->first();
            if ($existing) {
                $area = $existing;
            } elseif (Area::hasCapacity()) {
                $area = Area::create($areaData);
            } else {
                break;
            }

            foreach ($params as $p) {
                if (! $area->parameters()->where('name', $p['name'])->exists()) {
                    $area->parameters()->create([
                        'parameter_letter' => $p['parameter_letter'],
                        'name' => $p['name'],
                        'details' => $p['details'],
                        'is_custom' => false,
                    ]);
                }
            }
        }
    }
}