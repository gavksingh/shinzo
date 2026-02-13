import { Model, DataTypes, Sequelize } from 'sequelize'
import { CommonModel, commonFields } from '../Common'

export class RedactionRule extends Model {
    public uuid!: string
    public user_uuid!: string
    public rule_name!: string
    public rule_type!: 'regex' | 'field_name' | 'builtin'
    public pattern!: string
    public replacement!: string
    public is_enabled!: boolean
    public is_builtin!: boolean
    public target_fields!: string[]
    public created_at!: Date
    public updated_at!: Date

    static initialize(sequelize: Sequelize) {
        RedactionRule.init(
            {
                uuid: {
                    type: DataTypes.UUID,
                    primaryKey: true,
                    defaultValue: DataTypes.UUIDV4,
                },
                user_uuid: {
                    type: DataTypes.UUID,
                    allowNull: false,
                },
                rule_name: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                },
                rule_type: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                    validate: {
                        isIn: [['regex', 'field_name', 'builtin']],
                    },
                },
                pattern: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                },
                replacement: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                    defaultValue: '[REDACTED]',
                },
                is_enabled: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
                is_builtin: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
                target_fields: {
                    type: DataTypes.ARRAY(DataTypes.TEXT),
                    allowNull: false,
                    defaultValue: ['request_data', 'response_data', 'tool_input', 'tool_output', 'system_prompt'],
                },
                created_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
                updated_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
            },
            {
                sequelize,
                modelName: 'RedactionRule',
                tableName: 'redaction_rule',
                schema: 'spotlight',
                timestamps: false,
            }
        )
    }
}
